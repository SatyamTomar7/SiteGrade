import { logger } from '../config/logger.js';

const isEnabled = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const shouldLogMemoryDiagnostics = isEnabled(process.env.ANALYSIS_MEMORY_LOGGING, true);

const formatMegabytes = (bytes = 0) => `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`;

export const getMemorySnapshot = () => {
  const usage = process.memoryUsage();

  return {
    rss: formatMegabytes(usage.rss),
    heapTotal: formatMegabytes(usage.heapTotal),
    heapUsed: formatMegabytes(usage.heapUsed),
    external: formatMegabytes(usage.external),
    arrayBuffers: formatMegabytes(usage.arrayBuffers || 0)
  };
};

export const logMemoryUsage = (message, metadata = {}) => {
  if (!shouldLogMemoryDiagnostics) {
    return;
  }

  logger.info(message, {
    ...metadata,
    memory: getMemorySnapshot()
  });
};
