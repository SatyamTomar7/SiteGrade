import { Queue } from 'bullmq';
import { redisClient } from '../config/redis.js';

export const analysisQueue = new Queue('website-analysis', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 60 * 60
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 60 * 60
    }
  }
});