import { Queue, QueueEvents } from 'bullmq';
import { redisClient } from '../config/redis.js';

const queueAttempts = Math.max(Number(process.env.ANALYSIS_QUEUE_ATTEMPTS) || 1, 1);
const queueBackoffDelayMs = Math.max(Number(process.env.ANALYSIS_QUEUE_BACKOFF_MS) || 1000, 0);
const removeCompletedCount = Math.max(Number(process.env.ANALYSIS_QUEUE_REMOVE_COMPLETE_COUNT) || 1000, 0);
const removeFailedCount = Math.max(Number(process.env.ANALYSIS_QUEUE_REMOVE_FAIL_COUNT) || 5000, 0);
const completedRetentionSeconds = Math.max(Number(process.env.ANALYSIS_QUEUE_REMOVE_COMPLETE_AGE_SEC) || 24 * 60 * 60, 0);
const failedRetentionSeconds = Math.max(Number(process.env.ANALYSIS_QUEUE_REMOVE_FAIL_AGE_SEC) || 7 * 24 * 60 * 60, 0);
const queueEventsConnection = redisClient.duplicate();

export const analysisQueue = new Queue('website-analysis', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: queueAttempts,
    backoff: {
      type: 'exponential',
      delay: queueBackoffDelayMs
    },
    removeOnComplete: {
      count: removeCompletedCount,
      age: completedRetentionSeconds
    },
    removeOnFail: {
      count: removeFailedCount,
      age: failedRetentionSeconds
    }
  }
});

export const analysisQueueEvents = new QueueEvents('website-analysis', {
  connection: queueEventsConnection
});

export const closeAnalysisQueueResources = async () => {
  await Promise.allSettled([
    analysisQueueEvents.close(),
    queueEventsConnection.quit()
  ]);
};
