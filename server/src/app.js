import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';

import { connectDB } from './config/db.js';
import { closeRedis, connectRedis, isRedisConfigured, redisClient } from './config/redis.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import analysisRoutes from './modules/analysis/analysis.routes.js';
import schedulesRoutes from './modules/schedules/schedules.routes.js';
import hooksRoutes from './modules/hooks/hooks.routes.js';
import workspacesRoutes from './modules/workspaces/workspaces.routes.js';
import { startAnalysisWorker } from './queues/analysisWorker.js';
import { startScheduleWorker, stopScheduleWorker } from './queues/scheduleWorker.js';

dotenv.config();

const isEnabled = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const app = express();
const PORT = process.env.PORT || 5000;
const runAnalysisWorkerInApi = isEnabled(process.env.RUN_ANALYSIS_WORKER_IN_API, false);
const runScheduleWorkerInApi = isEnabled(process.env.RUN_SCHEDULE_WORKER_IN_API, true);
const allowedOrigins = [
  'http://localhost:5173',
  'https://site-grade.vercel.app',
  'https://sitegrade.tech',
  'https://www.sitegrade.tech',
  'https://sitegrade.onrender.com',
  'https://sitegrade-frontend.onrender.com',
  process.env.CLIENT_URL,
  process.env.PUBLIC_APP_URL
].filter(Boolean);
const screenshotsDir = path.resolve(process.env.SCREENSHOTS_DIR || './screenshots');

// Security middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests and known frontend origins.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/screenshots', express.static(screenshotsDir, {
  fallthrough: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

const healthResponse = (req, res) => {
  const redisStatus = !isRedisConfigured
    ? 'disabled'
    : redisClient.status === 'ready'
    ? 'ready'
    : redisClient.status;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ready',
      redis: redisStatus,
      analysisWorker: runAnalysisWorkerInApi ? 'embedded' : 'external',
      scheduleWorker: runScheduleWorkerInApi ? 'embedded' : 'external'
    }
  });
};

// Health checks
app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

// API routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/hooks', hooksRoutes);
app.use('/api/workspaces', workspacesRoutes);

// Global error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  stopScheduleWorker();
  await closeRedis();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

const startServer = async () => {
  try {
    await connectDB();
    const redisConnection = await connectRedis();

    if (redisConnection) {
      try {
        await redisClient.ping();
        logger.info('Redis connected successfully');
      } catch (error) {
        logger.warn('Redis accepted the connection but did not respond to ping cleanly', {
          message: error.message
        });
      }
    } else if (isRedisConfigured) {
      logger.warn(
        'Redis is currently unavailable. The API will continue running, but queue and cache features may fail until Redis recovers.'
      );
    }

    if (runAnalysisWorkerInApi) {
      startAnalysisWorker();
      logger.info('Analysis worker started inside API process');
    } else {
      logger.info('API started without embedded analysis worker; expecting a separate worker process');
    }

    if (runScheduleWorkerInApi) {
      startScheduleWorker();
      logger.info('Schedule worker started inside API process');
    } else {
      logger.info('API started without embedded schedule worker; expecting a separate scheduler process');
    }
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
