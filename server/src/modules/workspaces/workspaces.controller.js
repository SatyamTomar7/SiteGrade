import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendResponse } from '../../utils/apiResponse.js';
import * as workspacesService from './workspaces.service.js';

export const createWorkspace = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    const error = new Error('Workspace name is required');
    error.statusCode = 400;
    throw error;
  }

  const workspace = await workspacesService.createWorkspace(req.user, {
    name,
    description: req.body.description,
    members: req.body.members,
    active: req.body.active
  });
  sendResponse(res, 201, workspace, 'Workspace created successfully');
});

export const listWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await workspacesService.listWorkspaces(req.user);
  sendResponse(res, 200, workspaces, 'Workspaces retrieved successfully');
});

export const updateWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspacesService.updateWorkspace(req.params.workspaceId, req.user, req.body);
  sendResponse(res, 200, workspace, 'Workspace updated successfully');
});

export const deleteWorkspace = asyncHandler(async (req, res) => {
  await workspacesService.deleteWorkspace(req.params.workspaceId, req.user);
  sendResponse(res, 200, null, 'Workspace deleted successfully');
});

export const inviteWorkspaceMember = asyncHandler(async (req, res) => {
  const workspace = await workspacesService.inviteWorkspaceMember(req.params.workspaceId, req.user, req.body);
  sendResponse(res, 200, workspace, 'Workspace member invited successfully');
});

export const updateWorkspaceMember = asyncHandler(async (req, res) => {
  const workspace = await workspacesService.updateWorkspaceMember(req.params.workspaceId, req.params.memberId, req.user, req.body);
  sendResponse(res, 200, workspace, 'Workspace member updated successfully');
});

export const removeWorkspaceMember = asyncHandler(async (req, res) => {
  const workspace = await workspacesService.removeWorkspaceMember(req.params.workspaceId, req.params.memberId, req.user);
  sendResponse(res, 200, workspace, 'Workspace member removed successfully');
});

export const acceptWorkspaceInvite = asyncHandler(async (req, res) => {
  const workspace = await workspacesService.acceptWorkspaceInvite(req.params.token, req.user);
  sendResponse(res, 200, workspace, 'Workspace invite accepted successfully');
});

export const assignReportToWorkspace = asyncHandler(async (req, res) => {
  const result = await workspacesService.assignReportToWorkspace(
    req.params.reportId,
    req.user,
    req.body.workspaceId || null
  );
  sendResponse(res, 200, result, 'Report workspace updated successfully');
});
