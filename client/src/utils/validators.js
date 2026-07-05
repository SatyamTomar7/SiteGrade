import { z } from 'zod';

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

const otpSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code we emailed you');

export const urlSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .refine((val) => {
      try {
        new URL(val.startsWith('http') ? val : `https://${val}`);
        return true;
      } catch {
        return false;
      }
    }, 'Please enter a valid URL (e.g., https://example.com)')
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128, 'Password is too long')
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be 100 characters or fewer')
    .regex(/^[a-zA-Z]+(?:[ '\-][a-zA-Z]+)*$/, 'Please enter a valid full name'),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: otpSchema
});

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema
});

export const forgotPasswordOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  resetToken: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});
