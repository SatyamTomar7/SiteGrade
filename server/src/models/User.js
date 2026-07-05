import { SqlModel, attachPasswordMethods, createPasswordModelHooks } from './_sqlModel.js';

export const User = new SqlModel({
  tableName: 'users',
  hiddenFields: [
    'password',
    'emailVerificationOtpHash',
    'emailVerificationOtpExpiresAt',
    'passwordResetOtpHash',
    'passwordResetOtpExpiresAt'
  ],
  beforeSave: createPasswordModelHooks(),
  decorateDocument: attachPasswordMethods
});
