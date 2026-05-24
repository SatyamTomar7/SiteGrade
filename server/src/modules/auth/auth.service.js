import jwt from 'jsonwebtoken';
import { User } from '../../models/User.js';
import { logger } from '../../config/logger.js';

const buildAuthPayload = (user) => ({
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
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

const validateAuthPayload = ({ email, password, requireName = false, name }) => {
  if (requireName && (!name || !name.trim())) {
    const error = new Error('Name is required');
    error.statusCode = 400;
    throw error;
  }

  if (!email || !email.trim()) {
    const error = new Error('Email is required');
    error.statusCode = 400;
    throw error;
  }

  if (!password || !password.trim()) {
    const error = new Error('Password is required');
    error.statusCode = 400;
    throw error;
  }
};

export const registerUser = async ({ name, email, password }) => {
  validateAuthPayload({ name, email, password, requireName: true });

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  
  if (existingUser) {
    const error = new Error('User already exists');
    error.statusCode = 400;
    throw error;
  }
  
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password
  });
  
  const { accessToken, refreshToken } = generateTokens(user);
  
  return {
    ...buildAuthPayload(user),
    accessToken,
    refreshToken
  };
};

export const loginUser = async ({ email, password }) => {
  validateAuthPayload({ email, password });

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  
  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }
  
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
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
    const err = new Error('Invalid refresh token');
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(decoded.id);
  
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 401;
    throw error;
  }

  if ((decoded.version ?? 0) !== (user.refreshTokenVersion || 0)) {
    const error = new Error('Refresh token has been revoked');
    error.statusCode = 401;
    throw error;
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
