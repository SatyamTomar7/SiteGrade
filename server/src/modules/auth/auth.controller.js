import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendResponse } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.registerUser({ name, email, password });
  sendResponse(res, 201, result, 'User registered successfully');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.loginUser({ email, password });
  
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
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
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0)
  });
  
  sendResponse(res, 200, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req, res) => {
  sendResponse(res, 200, req.user, 'User retrieved successfully');
});
