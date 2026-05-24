import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendResponse } from '../../utils/apiResponse.js';
import * as hooksService from './hooks.service.js';
import { normalizeAnalysisUrl } from '../analysis/analysis.helpers.js';
import { assertSafeAnalysisUrl } from '../../utils/urlSafety.js';

const resolvePublicAppUrl = (req) => {
  const configuredUrl = process.env.PUBLIC_APP_URL || process.env.CLIENT_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0] : req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
};

export const createDeployHook = asyncHandler(async (req, res) => {
  const publicAppUrl = resolvePublicAppUrl(req);
  const url = await assertSafeAnalysisUrl(normalizeAnalysisUrl(req.body.url));
  const hook = await hooksService.createDeployHook(req.user._id, {
    name: String(req.body.name || '').trim() || `Deploy hook for ${url}`,
    url,
    active: req.body.active !== false,
    analysisConfig: req.body.analysisConfig || {}
  }, publicAppUrl);
  sendResponse(res, 201, hook, 'Deploy hook created successfully');
});

export const listDeployHooks = asyncHandler(async (req, res) => {
  const hooks = await hooksService.listDeployHooks(req.user._id, resolvePublicAppUrl(req));
  sendResponse(res, 200, hooks, 'Deploy hooks retrieved successfully');
});

export const updateDeployHook = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.url) {
    payload.url = await assertSafeAnalysisUrl(normalizeAnalysisUrl(payload.url));
  }
  const hook = await hooksService.updateDeployHook(req.params.hookId, req.user._id, payload, resolvePublicAppUrl(req));
  sendResponse(res, 200, hook, 'Deploy hook updated successfully');
});

export const deleteDeployHook = asyncHandler(async (req, res) => {
  await hooksService.deleteDeployHook(req.params.hookId, req.user._id);
  sendResponse(res, 200, null, 'Deploy hook deleted successfully');
});

export const triggerDeployHook = asyncHandler(async (req, res) => {
  const result = await hooksService.triggerDeployHook(req.params.token, {
    source: req.get('user-agent') || 'deploy-hook',
    payload: req.body || {}
  });
  sendResponse(res, 202, result, 'Deploy hook triggered successfully');
});
