import { logger } from '../config/logger.js';
import { queueDueSchedules } from '../modules/schedules/schedules.service.js';

const schedulePollIntervalMs = Math.max(Number(process.env.SCHEDULE_WORKER_POLL_MS) || 60000, 10000);
let scheduleTimer = null;
let isRunning = false;

const runTick = async () => {
  if (isRunning) {
    return;
  }

  isRunning = true;
  try {
    const queuedCount = await queueDueSchedules();
    if (queuedCount > 0) {
      logger.info(`Schedule worker queued ${queuedCount} due scan(s)`);
    }
  } catch (error) {
    logger.error(`Schedule worker tick failed: ${error.message}`);
  } finally {
    isRunning = false;
  }
};

export const startScheduleWorker = () => {
  if (scheduleTimer) {
    return scheduleTimer;
  }

  scheduleTimer = setInterval(runTick, schedulePollIntervalMs);
  scheduleTimer.unref?.();
  runTick();
  logger.info('Schedule worker started', { pollIntervalMs: schedulePollIntervalMs });
  return scheduleTimer;
};

export const stopScheduleWorker = () => {
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
    scheduleTimer = null;
  }
};
