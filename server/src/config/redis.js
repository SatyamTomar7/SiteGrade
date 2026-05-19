import 'dotenv/config';
import Redis from 'ioredis';
import { logger } from './logger.js';

const redisUrl = process.env.REDIS_URL?.trim();
const isTlsRedis = redisUrl?.startsWith('rediss://');

// Reusable singleton Redis client for the entire backend. We keep lazyConnect
// enabled so the app can boot even if Redis is temporarily unavailable.
const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: (attempt) => {
    const delay = Math.min(attempt * 250, 5000);
    logger.warn(`Redis reconnect attempt ${attempt}; retrying in ${delay}ms`);
    return delay;
  },
  ...(isTlsRedis
    ? {
        // Upstash production URLs use `rediss://...`. Passing an empty tls object
        // keeps certificate validation enabled while forcing a secure connection.
        tls: {}
      }
    : {})
};

// We intentionally avoid hardcoded localhost credentials. If REDIS_URL is missing,
// the client stays configured but Redis-dependent features will remain unavailable
// until the environment variable is provided.
export const redisClient = new Redis(
  redisUrl || 'redis://redis-not-configured.invalid:6379',
  redisOptions
);

let hasLoggedReady = false;

redisClient.on('connect', () => {
  logger.info('Redis socket connected');
});

redisClient.on('ready', () => {
  if (!hasLoggedReady) {
    hasLoggedReady = true;
    logger.info('Redis client ready for commands');
  } else {
    logger.info('Redis client reconnected and ready');
  }
});

redisClient.on('error', (error) => {
  logger.error('Redis client error:', {
    message: error.message,
    code: error.code,
    status: redisClient.status
  });
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis client reconnecting...');
});

redisClient.on('end', () => {
  logger.warn('Redis reconnection attempts ended');
});

export const isRedisConfigured = Boolean(redisUrl);

export const connectRedis = async () => {
  if (!isRedisConfigured) {
    logger.warn(
      'REDIS_URL is not configured. Queue and cache features will stay unavailable until it is set.'
    );
    return null;
  }

  if (redisClient.status === 'ready' || redisClient.status === 'connect') {
    return redisClient;
  }

  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Initial Redis connection failed:', {
      message: error.message,
      code: error.code
    });
    return null;
  }
};

export const closeRedis = async () => {
  if (redisClient.status === 'end') {
    return;
  }

  try {
    await redisClient.quit();
  } catch (error) {
    logger.warn('Redis quit failed, disconnecting forcibly instead', {
      message: error.message
    });
    redisClient.disconnect(false);
  }
};

// Example usage:
// await redisClient.set('sitegrade:healthcheck', 'ok', 'EX', 60);
// const cachedHealthcheck = await redisClient.get('sitegrade:healthcheck');
