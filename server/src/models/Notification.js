import { SqlModel } from './_sqlModel.js';

export const Notification = new SqlModel({
  tableName: 'notifications',
  jsonFields: ['metadata'],
  defaultSort: { createdAt: -1 },
  defaults: {
    read: false,
    metadata: {}
  }
});
