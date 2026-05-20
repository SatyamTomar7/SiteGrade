import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import { closeRedis, connectRedis, isRedisConfigured, redisClient } from './config/redis.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import analysisRoutes from './modules/analysis/analysis.routes.js';
import { startAnalysisWorker } from './queues/analysisWorker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  'http://localhost:5173',
  'https://site-grade-6lyx.vercel.app',
  'https://sitegrade.onrender.com',
  'https://sitegrade-frontend.onrender.com',
  process.env.CLIENT_URL
].filter(Boolean);

// Security middleware
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

const healthResponse = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

// Health checks
app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

// API routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);

// Global error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
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

    startAnalysisWorker();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
