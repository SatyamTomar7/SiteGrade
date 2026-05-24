import express from 'express';
import { protect } from '../auth/auth.middleware.js';
import {
  createDeployHook,
  deleteDeployHook,
  listDeployHooks,
  triggerDeployHook,
  updateDeployHook
} from './hooks.controller.js';

const router = express.Router();

router.post('/deploy/:token', express.json({ limit: '1mb' }), triggerDeployHook);
router.get('/', protect, listDeployHooks);
router.post('/', protect, createDeployHook);
router.put('/:hookId', protect, updateDeployHook);
router.delete('/:hookId', protect, deleteDeployHook);

export default router;
