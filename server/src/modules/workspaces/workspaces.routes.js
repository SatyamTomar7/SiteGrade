import express from 'express';
import { protect } from '../auth/auth.middleware.js';
import {
  acceptWorkspaceInvite,
  assignReportToWorkspace,
  createWorkspace,
  deleteWorkspace,
  inviteWorkspaceMember,
  listWorkspaces,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMember
} from './workspaces.controller.js';

const router = express.Router();

router.get('/', protect, listWorkspaces);
router.post('/', protect, createWorkspace);
router.put('/:workspaceId', protect, updateWorkspace);
router.delete('/:workspaceId', protect, deleteWorkspace);
router.post('/:workspaceId/members', protect, inviteWorkspaceMember);
router.patch('/:workspaceId/members/:memberId', protect, updateWorkspaceMember);
router.delete('/:workspaceId/members/:memberId', protect, removeWorkspaceMember);
router.post('/invites/:token/accept', protect, acceptWorkspaceInvite);
router.patch('/reports/:reportId/assign', protect, assignReportToWorkspace);

export default router;
