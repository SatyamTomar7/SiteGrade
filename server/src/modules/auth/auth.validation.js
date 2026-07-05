import { z } from 'zod';
import { createAppError } from '../../utils/appError.js';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be 255 characters or fewer');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter')
  .regex(/[0-9]/, 'Password must include at least one number');

const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'OTP must be a 6-digit code');

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be 100 characters or fewer')
    .regex(/^[a-zA-Z]+(?:[ '\-][a-zA-Z]+)*$/, 'Please enter a valid full name'),
  email: emailSchema,
  password: passwordSchema
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128, 'Password is too long')
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: otpSchema
});

export const emailOnlySchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    resetToken: z.string().trim().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export const parseRequest = (schema, payload) => {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw createAppError(
      result.error.issues[0]?.message || 'Invalid request payload',
      400,
      'VALIDATION_ERROR',
      result.error.flatten()
    );
  }

  return result.data;
};
