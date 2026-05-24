import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendResponse } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

const clearRefreshTokenCookie = (res) => {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0)
  });
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.registerUser({ name, email, password });
  setRefreshTokenCookie(res, result.refreshToken);
  sendResponse(res, 201, {
    user: result.user,
    accessToken: result.accessToken
  }, 'User registered successfully');
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
