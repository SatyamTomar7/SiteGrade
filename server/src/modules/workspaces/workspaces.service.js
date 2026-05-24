import crypto from 'crypto';
import { Workspace } from '../../models/Workspace.js';
import { WebsiteReport } from '../../models/WebsiteReport.js';

const normalizeMemberEntries = (items = []) => {
  const values = Array.isArray(items) ? items : [];
  const unique = new Map();

  values.forEach((item) => {
    const email = String(item?.email || item || '').trim().toLowerCase();
    if (!email) {
      return;
    }

    unique.set(email, {
      email,
      role: ['admin', 'editor', 'viewer'].includes(item?.role) ? item.role : 'viewer'
    });
  });

  return [...unique.values()].slice(0, 20);
};

const getMemberRole = (workspace, email = '') => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const member = workspace.members?.find((item) => item.email === normalizedEmail && item.status === 'active');
  return member?.role || null;
};

export const canAccessWorkspace = (workspace, user) => {
  if (!workspace || !user) {
    return false;
  }

  if (workspace.ownerId.toString() === user._id.toString()) {
    return true;
  }

  return Boolean(getMemberRole(workspace, user.email));
};

export const canManageWorkspace = (workspace, user) => {
  if (!workspace || !user) {
    return false;
  }

  if (workspace.ownerId.toString() === user._id.toString()) {
    return true;
  }

  return ['owner', 'admin'].includes(getMemberRole(workspace, user.email));
};

const buildWorkspaceSummary = (workspace, currentUser = null) => ({
  id: workspace._id,
  name: workspace.name,
  description: workspace.description,
  members: (workspace.members || []).map((member) => ({
    id: member._id,
    email: member.email,
    role: member.role,
    status: member.status,
    inviteToken: member.status === 'invited' ? member.inviteToken : '',
    addedAt: member.addedAt,
    acceptedAt: member.acceptedAt
  })),
  active: workspace.active,
  currentUserRole: workspace.ownerId?.toString?.() === currentUser?._id?.toString?.()
    ? 'owner'
    : getMemberRole(workspace, currentUser?.email) || null,
  createdAt: workspace.createdAt,
  updatedAt: workspace.updatedAt
});

const ensureWorkspaceAccess = async (workspaceId, user) => {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    const error = new Error('Workspace not found');
    error.statusCode = 404;
    throw error;
  }

  if (!canAccessWorkspace(workspace, user)) {
    const error = new Error('Not authorized to access this workspace');
    error.statusCode = 403;
    throw error;
  }

  return workspace;
};

const ensureWorkspaceManagement = async (workspaceId, user) => {
  const workspace = await ensureWorkspaceAccess(workspaceId, user);

  if (!canManageWorkspace(workspace, user)) {
    const error = new Error('Not authorized to manage this workspace');
    error.statusCode = 403;
    throw error;
  }

  return workspace;
};

export const createWorkspace = async (user, payload) => {
  const invitedMembers = normalizeMemberEntries(payload.members);
  const workspace = await Workspace.create({
    ownerId: user._id,
    name: payload.name,
    description: payload.description || '',
    members: [
      {
        email: user.email,
        role: 'owner',
        status: 'active',
        acceptedAt: new Date()
      },
      ...invitedMembers.map((member) => ({
        email: member.email,
        role: member.role,
        status: 'invited',
        inviteToken: crypto.randomUUID ? crypto.randomUUID() : `invite-${Date.now()}-${Math.random().toString(16).slice(2)}`
      }))
    ],
    active: payload.active !== false
  });

  return buildWorkspaceSummary(workspace, user);
};

export const listWorkspaces = async (user) => {
  const workspaces = await Workspace.find({
    $or: [
      { ownerId: user._id },
      { 'members.email': String(user.email || '').trim().toLowerCase() }
    ]
  }).sort({ createdAt: -1 });

  return workspaces
    .filter((workspace) => canAccessWorkspace(workspace, user))
    .map((workspace) => buildWorkspaceSummary(workspace, user));
};

export const updateWorkspace = async (workspaceId, user, payload) => {
  const workspace = await ensureWorkspaceManagement(workspaceId, user);
  if (payload.name !== undefined) workspace.name = payload.name;
  if (payload.description !== undefined) workspace.description = payload.description;
  if (payload.active !== undefined) workspace.active = payload.active;
  await workspace.save();
  return buildWorkspaceSummary(workspace, user);
};

export const deleteWorkspace = async (workspaceId, user) => {
  const workspace = await ensureWorkspaceManagement(workspaceId, user);
  await WebsiteReport.updateMany(
    {
      'workspaceContext.workspaceId': workspace._id
    },
    {
      $set: {
        'workspaceContext.workspaceId': null,
        'workspaceContext.workspaceName': ''
      }
    }
  );
  await workspace.deleteOne();
};

export const inviteWorkspaceMember = async (workspaceId, user, payload) => {
  const workspace = await ensureWorkspaceManagement(workspaceId, user);
  const email = String(payload.email || '').trim().toLowerCase();

  if (!email) {
    const error = new Error('Member email is required');
    error.statusCode = 400;
    throw error;
  }

  const existing = workspace.members.find((member) => member.email === email);
  if (existing) {
    existing.role = ['admin', 'editor', 'viewer'].includes(payload.role) ? payload.role : existing.role;
    if (existing.status === 'invited' && !existing.inviteToken) {
      existing.inviteToken = workspace.createInviteToken();
    }
  } else {
    workspace.members.push({
      email,
      role: ['admin', 'editor', 'viewer'].includes(payload.role) ? payload.role : 'viewer',
      status: 'invited',
      inviteToken: workspace.createInviteToken()
    });
  }

  await workspace.save();
  return buildWorkspaceSummary(workspace, user);
};

export const updateWorkspaceMember = async (workspaceId, memberId, user, payload) => {
  const workspace = await ensureWorkspaceManagement(workspaceId, user);
  const member = workspace.members.id(memberId);

  if (!member) {
    const error = new Error('Workspace member not found');
    error.statusCode = 404;
    throw error;
  }

  if (member.role === 'owner') {
    const error = new Error('Owner membership cannot be modified');
    error.statusCode = 400;
    throw error;
  }

  if (payload.role !== undefined) {
    member.role = ['admin', 'editor', 'viewer'].includes(payload.role) ? payload.role : member.role;
  }

  await workspace.save();
  return buildWorkspaceSummary(workspace, user);
};

export const removeWorkspaceMember = async (workspaceId, memberId, user) => {
  const workspace = await ensureWorkspaceManagement(workspaceId, user);
  const member = workspace.members.id(memberId);

  if (!member) {
    const error = new Error('Workspace member not found');
    error.statusCode = 404;
    throw error;
  }

  if (member.role === 'owner') {
    const error = new Error('Owner membership cannot be removed');
    error.statusCode = 400;
    throw error;
  }

  workspace.members.pull(memberId);
  await workspace.save();
  return buildWorkspaceSummary(workspace, user);
};

export const acceptWorkspaceInvite = async (token, user) => {
  const workspace = await Workspace.findOne({ 'members.inviteToken': token });

  if (!workspace) {
    const error = new Error('Invite not found');
    error.statusCode = 404;
    throw error;
  }

  const member = workspace.members.find((item) => item.inviteToken === token);
  if (!member) {
    const error = new Error('Invite not found');
    error.statusCode = 404;
    throw error;
  }

  if (member.email !== String(user.email || '').trim().toLowerCase()) {
    const error = new Error('This invite belongs to a different email address');
    error.statusCode = 403;
    throw error;
  }

  member.status = 'active';
  member.acceptedAt = new Date();
  member.inviteToken = '';
  await workspace.save();

  return buildWorkspaceSummary(workspace, user);
};

export const assignReportToWorkspace = async (reportId, user, workspaceId) => {
  let workspace = null;
  if (workspaceId) {
    workspace = await ensureWorkspaceManagement(workspaceId, user);
  }

  const report = await WebsiteReport.findById(reportId);
  if (!report) {
    const error = new Error('Report not found');
    error.statusCode = 404;
    throw error;
  }

  if (report.userId.toString() !== user._id.toString()) {
    const error = new Error('Not authorized to update this report');
    error.statusCode = 403;
    throw error;
  }

  report.workspaceContext = {
    workspaceId: workspace?._id || null,
    workspaceName: workspace?.name || ''
  };
  await report.save();

  return {
    reportId: report._id,
    workspaceContext: report.workspaceContext
  };
};
