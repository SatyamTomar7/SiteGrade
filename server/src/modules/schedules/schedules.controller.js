import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendResponse } from '../../utils/apiResponse.js';
import * as schedulesService from './schedules.service.js';
import { normalizeAnalysisUrl } from '../analysis/analysis.helpers.js';
import { assertSafeAnalysisUrl } from '../../utils/urlSafety.js';

const normalizeScheduleInput = async (body) => {
  const normalizedUrl = await assertSafeAnalysisUrl(normalizeAnalysisUrl(body.url));
  return {
    name: String(body.name || '').trim() || `Scheduled scan for ${normalizedUrl}`,
    url: normalizedUrl,
    frequency: body.frequency === 'daily' ? 'daily' : 'weekly',
    active: body.active !== false,
    nextRunAt: body.nextRunAt,
    analysisConfig: body.analysisConfig || {},
    deliveryChannels: body.deliveryChannels || []
  };
};

export const createSchedule = asyncHandler(async (req, res) => {
  const payload = await normalizeScheduleInput(req.body);
  const schedule = await schedulesService.createSchedule(req.user._id, payload);
  sendResponse(res, 201, schedule, 'Schedule created successfully');
});

export const listSchedules = asyncHandler(async (req, res) => {
  const schedules = await schedulesService.listSchedules(req.user._id);
  sendResponse(res, 200, schedules, 'Schedules retrieved successfully');
});

export const updateSchedule = asyncHandler(async (req, res) => {
  const payload = req.body.url
    ? await normalizeScheduleInput(req.body)
    : {
        ...req.body,
        frequency: req.body.frequency === 'daily' ? 'daily' : req.body.frequency === 'weekly' ? 'weekly' : undefined
      };
  const schedule = await schedulesService.updateSchedule(req.params.scheduleId, req.user._id, payload);
  sendResponse(res, 200, schedule, 'Schedule updated successfully');
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  await schedulesService.deleteSchedule(req.params.scheduleId, req.user._id);
  sendResponse(res, 200, null, 'Schedule deleted successfully');
});

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await schedulesService.listNotifications(req.user._id);
  sendResponse(res, 200, notifications, 'Notifications retrieved successfully');
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await schedulesService.markNotificationRead(req.params.notificationId, req.user._id);
  sendResponse(res, 200, null, 'Notification marked as read');
});
