import { ScanSchedule } from '../../models/ScanSchedule.js';
import { Notification } from '../../models/Notification.js';
import { WebsiteReport } from '../../models/WebsiteReport.js';
import { analysisQueue } from '../../queues/analysisQueue.js';
import { logger } from '../../config/logger.js';

const SCHEDULE_INTERVALS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
};

const normalizeDeliveryChannels = (channels = []) => {
  const normalized = Array.isArray(channels) ? channels : [];
  const filtered = normalized
    .map((channel) => ({
      type: channel.type,
      enabled: channel.enabled !== false,
      target: String(channel.target || '').trim()
    }))
    .filter((channel) => ['in_app', 'email', 'slack'].includes(channel.type));

  if (!filtered.some((channel) => channel.type === 'in_app')) {
    filtered.unshift({ type: 'in_app', enabled: true, target: '' });
  }

  return filtered;
};

const postSlackMessage = async (webhookUrl, text) => {
  if (!webhookUrl) {
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    return response.ok;
  } catch (error) {
    logger.warn(`Slack alert delivery failed: ${error.message}`);
    return false;
  }
};

const computeNextRunAt = (frequency, fromDate = new Date()) => {
  const intervalMs = SCHEDULE_INTERVALS[frequency] || SCHEDULE_INTERVALS.weekly;
  return new Date(fromDate.getTime() + intervalMs);
};

const buildScheduleSummary = (schedule) => ({
  id: schedule._id,
  name: schedule.name,
  url: schedule.url,
  frequency: schedule.frequency,
  active: schedule.active,
  nextRunAt: schedule.nextRunAt,
  lastRunAt: schedule.lastRunAt,
  lastReportId: schedule.lastReportId,
  lastStatus: schedule.lastStatus,
  lastAlertSummary: schedule.lastAlertSummary,
  deliveryChannels: schedule.deliveryChannels,
  analysisConfig: schedule.analysisConfig,
  createdAt: schedule.createdAt,
  updatedAt: schedule.updatedAt
});

const ensureOwnedSchedule = async (scheduleId, userId) => {
  const schedule = await ScanSchedule.findById(scheduleId);

  if (!schedule) {
    const error = new Error('Schedule not found');
    error.statusCode = 404;
    throw error;
  }

  if (schedule.userId.toString() !== userId.toString()) {
    const error = new Error('Not authorized to access this schedule');
    error.statusCode = 403;
    throw error;
  }

  return schedule;
};

export const createSchedule = async (userId, input) => {
  const schedule = await ScanSchedule.create({
    userId,
    name: input.name,
    url: input.url,
    frequency: input.frequency || 'weekly',
    active: input.active !== false,
    nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : computeNextRunAt(input.frequency || 'weekly'),
    analysisConfig: input.analysisConfig || {},
    deliveryChannels: normalizeDeliveryChannels(input.deliveryChannels)
  });

  return buildScheduleSummary(schedule);
};

export const listSchedules = async (userId) => {
  const schedules = await ScanSchedule.find({ userId }).sort({ createdAt: -1 }).lean();
  return schedules.map(buildScheduleSummary);
};

export const updateSchedule = async (scheduleId, userId, input) => {
  const schedule = await ensureOwnedSchedule(scheduleId, userId);

  if (input.name !== undefined) schedule.name = input.name;
  if (input.url !== undefined) schedule.url = input.url;
  if (input.frequency !== undefined) schedule.frequency = input.frequency;
  if (input.active !== undefined) schedule.active = input.active;
  if (input.analysisConfig !== undefined) schedule.analysisConfig = input.analysisConfig;
  if (input.deliveryChannels !== undefined) schedule.deliveryChannels = normalizeDeliveryChannels(input.deliveryChannels);
  if (input.nextRunAt !== undefined) schedule.nextRunAt = new Date(input.nextRunAt);

  await schedule.save();
  return buildScheduleSummary(schedule);
};

export const deleteSchedule = async (scheduleId, userId) => {
  const schedule = await ensureOwnedSchedule(scheduleId, userId);
  await schedule.deleteOne();
};

export const listNotifications = async (userId) => {
  const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
  return notifications.map((item) => ({
    id: item._id,
    type: item.type,
    title: item.title,
    message: item.message,
    read: item.read,
    metadata: item.metadata,
    createdAt: item.createdAt
  }));
};

export const markNotificationRead = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);

  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  if (notification.userId.toString() !== userId.toString()) {
    const error = new Error('Not authorized to update this notification');
    error.statusCode = 403;
    throw error;
  }

  notification.read = true;
  await notification.save();
};

export const createNotification = async (userId, payload) => {
  return Notification.create({
    userId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    metadata: payload.metadata || {}
  });
};

export const queueDueSchedules = async () => {
  const now = new Date();
  const dueSchedules = await ScanSchedule.find({
    active: true,
    nextRunAt: { $lte: now }
  }).limit(10);

  for (const schedule of dueSchedules) {
    try {
      const report = await WebsiteReport.create({
        userId: schedule.userId,
        url: schedule.url,
        status: 'pending',
        analysisConfig: schedule.analysisConfig || {},
        scheduleContext: {
          scheduleId: schedule._id,
          triggeredBy: 'schedule'
        }
      });

      const job = await analysisQueue.add('analyze-website', {
        reportId: report._id.toString(),
        url: schedule.url,
        analysisConfig: schedule.analysisConfig || {},
        scheduleId: schedule._id.toString()
      });

      schedule.lastRunAt = now;
      schedule.lastReportId = report._id;
      schedule.lastStatus = 'queued';
      schedule.nextRunAt = computeNextRunAt(schedule.frequency, now);
      schedule.lastAlertSummary = `Queued automatically on ${now.toISOString()}`;
      await schedule.save();

      await createNotification(schedule.userId, {
        type: 'schedule_due',
        title: 'Scheduled scan queued',
        message: `${schedule.name} was queued for ${schedule.url}.`,
        metadata: {
          scheduleId: schedule._id,
          reportId: report._id,
          jobId: job.id
        }
      });
    } catch (error) {
      logger.error(`Failed to queue due schedule ${schedule._id}: ${error.message}`);
    }
  }

  return dueSchedules.length;
};

const deliverScheduleAlerts = async (schedule, report, title, message, type) => {
  const enabledChannels = (schedule.deliveryChannels || []).filter((channel) => channel.enabled);

  for (const channel of enabledChannels) {
    if (channel.type === 'in_app') {
      await createNotification(schedule.userId, {
        type,
        title,
        message,
        metadata: {
          scheduleId: schedule._id,
          reportId: report?._id || null
        }
      });
      continue;
    }

    if (channel.type === 'email') {
      logger.info(`Email alert prepared for schedule ${schedule._id}`, {
        target: channel.target || 'account-email',
        title
      });
      continue;
    }

    if (channel.type === 'slack') {
      const delivered = await postSlackMessage(
        channel.target || process.env.SLACK_WEBHOOK_URL,
        `${title}\n${message}`
      );
      logger.info(`Slack alert ${delivered ? 'sent' : 'prepared'} for schedule ${schedule._id}`, {
        target: channel.target || 'configured-webhook',
        title
      });
    }
  }
};

export const handleScheduledReportCompleted = async (report) => {
  const scheduleId = report?.scheduleContext?.scheduleId;
  if (!scheduleId) return;

  const schedule = await ScanSchedule.findById(scheduleId);
  if (!schedule) return;

  schedule.lastStatus = 'completed';
  schedule.lastReportId = report._id;
  schedule.lastAlertSummary = `Completed with score ${report.overallScore}/100`;
  await schedule.save();

  await deliverScheduleAlerts(
    schedule,
    report,
    'Scheduled scan completed',
    `${schedule.name} completed for ${schedule.url} with a score of ${report.overallScore}/100.`,
    'schedule_completed'
  );
};

export const handleScheduledReportFailed = async (reportId, errorMessage) => {
  const report = await WebsiteReport.findById(reportId).lean();
  const scheduleId = report?.scheduleContext?.scheduleId;
  if (!scheduleId) return;

  const schedule = await ScanSchedule.findById(scheduleId);
  if (!schedule) return;

  schedule.lastStatus = 'failed';
  schedule.lastAlertSummary = errorMessage || 'Scheduled scan failed';
  await schedule.save();

  await deliverScheduleAlerts(
    schedule,
    report,
    'Scheduled scan failed',
    `${schedule.name} failed for ${schedule.url}. ${errorMessage || 'Please review the latest run.'}`,
    'schedule_failed'
  );
};
