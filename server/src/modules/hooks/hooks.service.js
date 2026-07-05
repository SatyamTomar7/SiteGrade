import { DeployHook } from '../../models/DeployHook.js';
import * as analysisService from '../analysis/analysis.service.js';
import { analysisQueue } from '../../queues/analysisQueue.js';

const buildHookSummary = (hook, publicAppUrl = '') => ({
  id: hook._id,
  name: hook.name,
  url: hook.url,
  active: hook.active,
  analysisConfig: hook.analysisConfig,
  lastTriggeredAt: hook.lastTriggeredAt,
  token: hook.token,
  webhookUrl: publicAppUrl ? `${publicAppUrl}/api/hooks/deploy/${hook.token}` : `/api/hooks/deploy/${hook.token}`,
  createdAt: hook.createdAt,
  updatedAt: hook.updatedAt
});

const ensureOwnedHook = async (hookId, userId) => {
  const hook = await DeployHook.findById(hookId);

  if (!hook) {
    const error = new Error('Deploy hook not found');
    error.statusCode = 404;
    throw error;
  }

  if (hook.userId.toString() !== userId.toString()) {
    const error = new Error('Not authorized to access this deploy hook');
    error.statusCode = 403;
    throw error;
  }

  return hook;
};

export const createDeployHook = async (userId, payload, publicAppUrl) => {
  const hook = await DeployHook.create({
    userId,
    name: payload.name,
    url: payload.url,
    active: payload.active !== false,
    analysisConfig: payload.analysisConfig || {}
  });

  return buildHookSummary(hook, publicAppUrl);
};

export const listDeployHooks = async (userId, publicAppUrl) => {
  const hooks = await DeployHook.find({ userId }).sort({ createdAt: -1 }).lean();
  return hooks.map((hook) => buildHookSummary(hook, publicAppUrl));
};

export const updateDeployHook = async (hookId, userId, payload, publicAppUrl) => {
  const hook = await ensureOwnedHook(hookId, userId);
  if (payload.name !== undefined) hook.name = payload.name;
  if (payload.url !== undefined) hook.url = payload.url;
  if (payload.active !== undefined) hook.active = payload.active;
  if (payload.analysisConfig !== undefined) hook.analysisConfig = payload.analysisConfig;
  await hook.save();
  return buildHookSummary(hook, publicAppUrl);
};

export const deleteDeployHook = async (hookId, userId) => {
  const hook = await ensureOwnedHook(hookId, userId);
  await hook.deleteOne();
};

export const triggerDeployHook = async (token, metadata = {}) => {
  const hook = await DeployHook.findOne({ token, active: true });

  if (!hook) {
    const error = new Error('Deploy hook not found');
    error.statusCode = 404;
    throw error;
  }

  const analysisConfig = {
    ...(hook.analysisConfig || {}),
    triggeredBy: 'manual'
  };
  const report = await analysisService.createReport(hook.userId, hook.url, analysisConfig);
  let job;

  try {
    job = await analysisQueue.add('analyze-website', {
      reportId: report._id.toString(),
      url: hook.url,
      analysisConfig,
      deployMetadata: metadata
    });
  } catch (queueError) {
    await analysisService.markReportFailed(
      report._id,
      'Deploy-triggered analysis could not be queued because Redis is temporarily unavailable.'
    );

    const error = new Error('Analysis queue is temporarily unavailable. Please try again in a moment.');
    error.statusCode = 503;
    throw error;
  }

  hook.lastTriggeredAt = new Date();
  await hook.save();

  return {
    hookId: hook._id,
    reportId: report._id,
    jobId: job.id
  };
};
