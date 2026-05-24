import express from 'express';
import { protect } from '../auth/auth.middleware.js';
import {
  createSchedule,
  deleteSchedule,
  listNotifications,
  listSchedules,
  markNotificationRead,
  updateSchedule
} from './schedules.controller.js';

const router = express.Router();

router.get('/', protect, listSchedules);
router.post('/', protect, createSchedule);
router.put('/:scheduleId', protect, updateSchedule);
router.delete('/:scheduleId', protect, deleteSchedule);

router.get('/notifications/list', protect, listNotifications);
router.patch('/notifications/:notificationId/read', protect, markNotificationRead);

export default router;
