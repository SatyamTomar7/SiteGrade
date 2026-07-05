import crypto from 'node:crypto';
import { SqlModel } from './_sqlModel.js';

export const DeployHook = new SqlModel({
  tableName: 'deploy_hooks',
  jsonFields: ['analysisConfig'],
  defaultSort: { createdAt: -1 },
  defaults: {
    analysisConfig: {},
    active: true,
    lastTriggeredAt: null
  },
  beforeSave: async (data) => ({
    ...data,
    token: data.token || crypto.randomBytes(18).toString('hex')
  })
});
