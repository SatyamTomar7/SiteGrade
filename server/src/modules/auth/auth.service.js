import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User.js';
import { logger } from '../../config/logger.js';
import { createAppError } from '../../utils/appError.js';
import { sanitizeEmailTemplateValue, sendEmail } from '../../services/email.service.js';
import {
  emailOnlySchema,
  loginSchema,
  parseRequest,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from './auth.validation.js';

const buildAuthPayload = (user) => ({
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified
  }
});

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' }
  );
  
  const refreshToken = jwt.sign(
    { id: user._id, version: user.refreshTokenVersion || 0 },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d' }
  );
  
  return { accessToken, refreshToken };
};

const OTP_TTL_MINUTES = 10;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');
const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const signPasswordResetToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, type: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: `${PASSWORD_RESET_TOKEN_TTL_MINUTES}m` }
  );

const verifyPasswordResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid reset token');
    }

    return decoded;
  } catch {
    throw createAppError('This password reset session is invalid or has expired', 401, 'INVALID_RESET_TOKEN');
  }
};

const buildOtpExpiry = () => new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
const buildSafeDisplayName = (value) => sanitizeEmailTemplateValue(value || 'there');

const logEmailFailure = (message, user, error) => {
  logger.error(message, {
    email: user.email,
    code: error.code,
    statusCode: error.statusCode,
    errorMessage: error.message
  });
};

const sendVerificationEmail = async (user, otp) => {
  const safeName = buildSafeDisplayName(user.name);
  await sendEmail({
    to: user.email,
    subject: 'Verify your SiteGrade email',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin-bottom:12px">Verify your email</h2>
        <p>Hello ${safeName},</p>
        <p>Use the verification code below to activate your SiteGrade account.</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${otp}</p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>
      </div>
    `
  });
};

const sendPasswordResetEmail = async (user, otp) => {
  const safeName = buildSafeDisplayName(user.name);
  await sendEmail({
    to: user.email,
    subject: 'Your SiteGrade password reset code',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin-bottom:12px">Reset your password</h2>
        <p>Hello ${safeName},</p>
        <p>Use the code below to continue resetting your SiteGrade password.</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${otp}</p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>
      </div>
    `
  });
};

const assignEmailVerificationOtp = async (user) => {
  const otp = generateOtp();
  user.emailVerificationOtpHash = hashOtp(otp);
  user.emailVerificationOtpExpiresAt = buildOtpExpiry();
  await user.save();
  await sendVerificationEmail(user, otp);
};

const assignPasswordResetOtp = async (user) => {
  const otp = generateOtp();
  user.passwordResetOtpHash = hashOtp(otp);
  user.passwordResetOtpExpiresAt = buildOtpExpiry();
  await user.save();
  await sendPasswordResetEmail(user, otp);
};

export const registerUser = async ({ name, email, password }) => {
  const payload = parseRequest(registerSchema, { name, email, password });

  const normalizedEmail = payload.email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  
  if (existingUser) {
    throw createAppError('An account with this email already exists', 400, 'USER_EXISTS');
  }
  
  const user = await User.create({
    name: payload.name.trim(),
    email: normalizedEmail,
    password: payload.password
  });

  try {
    await assignEmailVerificationOtp(user);
  } catch (error) {
    logEmailFailure('Failed to send verification email during registration', user, error);

    await User.deleteOne({ _id: user._id });

    throw createAppError(
      'We could not send your verification email right now. Please try signing up again in a moment.',
      503,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  logger.info(`User registered and verification OTP created: ${user.email}`);
  
  return {
    email: user.email,
    requiresEmailVerification: true
  };
};

export const loginUser = async ({ email, password }) => {
  const payload = parseRequest(loginSchema, { email, password });

  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  
  if (!user) {
    throw createAppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  
  const isMatch = await user.comparePassword(payload.password);
  
  if (!isMatch) {
    throw createAppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.emailVerified) {
    try {
      await assignEmailVerificationOtp(user);
    } catch (error) {
      logEmailFailure('Failed to resend verification email during login', user, error);
      throw createAppError(
        'We could not send your verification email right now. Please try again shortly.',
        503,
        'EMAIL_DELIVERY_FAILED'
      );
    }

    throw createAppError(
      'Please verify your email before signing in. We sent you a fresh verification code.',
      403,
      'EMAIL_NOT_VERIFIED',
      { email: user.email }
    );
  }
  
  const { accessToken, refreshToken } = generateTokens(user);
  
  logger.info(`User logged in: ${user.email}`);
  
  return {
    ...buildAuthPayload(user),
    accessToken,
    refreshToken
  };
};

export const refreshAccessToken = async (refreshToken) => {
  let decoded;

  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw createAppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(decoded.id);
  
  if (!user) {
    throw createAppError('User not found', 401, 'USER_NOT_FOUND');
  }

  if ((decoded.version ?? 0) !== (user.refreshTokenVersion || 0)) {
    throw createAppError('Refresh token has been revoked', 401, 'REFRESH_TOKEN_REVOKED');
  }
  
  const tokens = generateTokens(user);
  
  return {
    accessToken: tokens.accessToken,
    ...buildAuthPayload(user)
  };
};

export const revokeRefreshToken = async (refreshToken) => {
  let decoded;

  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return;
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return;
  }

  user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
  await user.save();
};

export const verifyEmailOtp = async ({ email, otp }) => {
  const payload = parseRequest(verifyEmailSchema, { email, otp });
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+emailVerificationOtpHash +emailVerificationOtpExpiresAt'
  );

  if (!user) {
    throw createAppError('We could not find an account for this email', 404, 'USER_NOT_FOUND');
  }

  if (user.emailVerified) {
    const tokens = generateTokens(user);
    return {
      ...buildAuthPayload(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      alreadyVerified: true
    };
  }

  if (!user.emailVerificationOtpHash || !user.emailVerificationOtpExpiresAt) {
    throw createAppError('No verification code is active for this account', 400, 'NO_ACTIVE_OTP');
  }

  if (user.emailVerificationOtpExpiresAt.getTime() < Date.now()) {
    throw createAppError('This verification code has expired. Please request a new one.', 400, 'OTP_EXPIRED');
  }

  if (user.emailVerificationOtpHash !== hashOtp(payload.otp)) {
    throw createAppError('The verification code you entered is incorrect', 400, 'INVALID_OTP');
  }

  user.emailVerified = true;
  user.emailVerificationOtpHash = undefined;
  user.emailVerificationOtpExpiresAt = undefined;
  await user.save();

  const tokens = generateTokens(user);
  logger.info(`User email verified: ${user.email}`);

  return {
    ...buildAuthPayload(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
};

export const resendEmailVerificationOtp = async ({ email }) => {
  const payload = parseRequest(emailOnlySchema, { email });
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+emailVerificationOtpHash +emailVerificationOtpExpiresAt'
  );

  if (!user) {
    throw createAppError('We could not find an account for this email', 404, 'USER_NOT_FOUND');
  }

  if (user.emailVerified) {
    throw createAppError('This email address is already verified', 400, 'EMAIL_ALREADY_VERIFIED');
  }

  try {
    await assignEmailVerificationOtp(user);
  } catch (error) {
    logEmailFailure('Failed to resend verification email', user, error);
    throw createAppError(
      'We could not send a new verification code right now. Please try again shortly.',
      503,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  return {
    email: user.email,
    requiresEmailVerification: true
  };
};

export const requestPasswordResetOtp = async ({ email }) => {
  const payload = parseRequest(emailOnlySchema, { email });
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordResetOtpHash +passwordResetOtpExpiresAt'
  );

  if (user) {
    try {
      await assignPasswordResetOtp(user);
    } catch (error) {
      logEmailFailure('Failed to send password reset email', user, error);
    }
  }

  return {
    email: normalizedEmail
  };
};

export const verifyPasswordResetOtp = async ({ email, otp }) => {
  const payload = parseRequest(verifyEmailSchema, { email, otp });
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordResetOtpHash +passwordResetOtpExpiresAt'
  );

  if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
    throw createAppError('No password reset request is active for this email', 400, 'NO_ACTIVE_PASSWORD_RESET');
  }

  if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
    throw createAppError('This reset code has expired. Please request a new one.', 400, 'OTP_EXPIRED');
  }

  if (user.passwordResetOtpHash !== hashOtp(payload.otp)) {
    throw createAppError('The password reset code you entered is incorrect', 400, 'INVALID_OTP');
  }

  return {
    email: user.email,
    resetToken: signPasswordResetToken(user)
  };
};

export const resetPasswordWithToken = async ({ email, resetToken, password, confirmPassword }) => {
  const payload = parseRequest(resetPasswordSchema, { email, resetToken, password, confirmPassword });
  const decoded = verifyPasswordResetToken(payload.resetToken);
  const normalizedEmail = payload.email.trim().toLowerCase();

  if (decoded.email !== normalizedEmail) {
    throw createAppError('This reset session does not match the provided email', 400, 'RESET_EMAIL_MISMATCH');
  }

  const user = await User.findById(decoded.id).select('+password');

  if (!user || user.email !== normalizedEmail) {
    throw createAppError('We could not find an account for this reset request', 404, 'USER_NOT_FOUND');
  }

  user.password = payload.password;
  user.passwordResetOtpHash = undefined;
  user.passwordResetOtpExpiresAt = undefined;
  user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
  await user.save();

  logger.info(`User password reset completed: ${user.email}`);

  return {
    email: user.email
  };
};
