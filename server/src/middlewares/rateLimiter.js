import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger.js';

export const analysisRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many analysis requests from this IP, please try again after 15 minutes'
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on analysis endpoint`);
    res.status(options.statusCode).json(options.message);
  },
  skip: (req) => {
    return req.user?.role === 'admin';
  }
});