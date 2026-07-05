import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendResponse } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';

const cookieSameSite = process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');
const cookieSecure = process.env.COOKIE_SECURE
  ? ['1', 'true', 'yes', 'on'].includes(process.env.COOKIE_SECURE.trim().toLowerCase())
  : process.env.NODE_ENV === 'production';

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

const clearRefreshTokenCookie = (res) => {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    expires: new Date(0)
  });
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.registerUser({ name, email, password });
  sendResponse(res, 201, result, 'Account created. Please verify your email with the code we sent.');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.loginUser({ email, password });
  
  setRefreshTokenCookie(res, result.refreshToken);
  
  sendResponse(res, 200, {
    user: result.user,
    accessToken: result.accessToken
  }, 'Login successful');
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const result = await authService.verifyEmailOtp({ email, otp });
  setRefreshTokenCookie(res, result.refreshToken);

  sendResponse(res, 200, {
    user: result.user,
    accessToken: result.accessToken
  }, result.alreadyVerified ? 'Email already verified' : 'Email verified successfully');
});

export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.resendEmailVerificationOtp({ email });
  sendResponse(res, 200, result, 'A new verification code has been sent');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.requestPasswordResetOtp({ email });
  sendResponse(
    res,
    200,
    result,
    'If that email is registered, a password reset code has been sent.'
  );
});

export const verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const result = await authService.verifyPasswordResetOtp({ email, otp });
  sendResponse(res, 200, result, 'Reset code verified successfully');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, resetToken, password, confirmPassword } = req.body;
  const result = await authService.resetPasswordWithToken({ email, resetToken, password, confirmPassword });
  sendResponse(res, 200, result, 'Password reset successfully. You can now sign in.');
});

export const refreshToken = asyncHandler(async (req, res) => {
  const refreshTokenCookie = req.cookies.refreshToken;
  
  if (!refreshTokenCookie) {
    res.status(401);
    throw new Error('No refresh token provided');
  }
  
  const result = await authService.refreshAccessToken(refreshTokenCookie);
  sendResponse(res, 200, result, 'Token refreshed successfully');
});

export const logout = asyncHandler(async (req, res) => {
  if (req.cookies.refreshToken) {
    await authService.revokeRefreshToken(req.cookies.refreshToken);
  }

  clearRefreshTokenCookie(res);
  
  sendResponse(res, 200, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req, res) => {
  sendResponse(res, 200, req.user, 'User retrieved successfully');
});
