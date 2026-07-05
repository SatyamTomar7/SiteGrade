import crypto from 'node:crypto';
import { SqlModel } from './_sqlModel.js';

export const Workspace = new SqlModel({
  tableName: 'workspaces',
  jsonFields: ['members'],
  defaultSort: { createdAt: -1 },
  defaults: {
    description: '',
    members: [],
    active: true
  },
  beforeSave: async (data) => ({
    ...data,
    members: (Array.isArray(data.members) ? data.members : []).map((member) => ({
      _id: member._id || member.id || crypto.randomUUID(),
      ...member
    }))
  }),
  decorateDocument(document) {
    Object.defineProperty(document, 'createInviteToken', {
      enumerable: false,
      value() {
        return crypto.randomBytes(18).toString('hex');
      }
    });
  }
});
