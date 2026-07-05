import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, KeyRound, Lock, Mail } from 'lucide-react';
import { authApi } from '../api/auth.api';
import {
  forgotPasswordOtpSchema,
  forgotPasswordRequestSchema,
  resetPasswordSchema
} from '../utils/validators';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AuthShell } from '../components/AuthShell';

const RESET_SESSION_KEY = 'sitegrade-password-reset';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetEmail = searchParams.get('email') || '';
  const [step, setStep] = useState(1);
  const [serverMessage, setServerMessage] = useState('');
  const [verifiedResetToken, setVerifiedResetToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState(presetEmail);

  const requestForm = useForm({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: presetEmail }
  });

  const otpForm = useForm({
    resolver: zodResolver(forgotPasswordOtpSchema),
    defaultValues: { email: presetEmail, otp: '' }
  });

  const resetForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: presetEmail, resetToken: '', password: '', confirmPassword: '' }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedSession = window.sessionStorage.getItem(RESET_SESSION_KEY);
    if (!savedSession) {
      return;
    }

    try {
      const parsed = JSON.parse(savedSession);

      if (parsed?.email) {
        setVerifiedEmail(parsed.email);
        requestForm.setValue('email', parsed.email);
        otpForm.setValue('email', parsed.email);
        resetForm.setValue('email', parsed.email);
      }

      if (parsed?.step === 3 && parsed?.resetToken) {
        setVerifiedResetToken(parsed.resetToken);
        resetForm.setValue('resetToken', parsed.resetToken);
        setStep(3);
      } else if (parsed?.step === 2) {
        setStep(2);
      }
    } catch {
      window.sessionStorage.removeItem(RESET_SESSION_KEY);
    }
  }, [otpForm, requestForm, resetForm]);

  const persistResetSession = (nextState) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(RESET_SESSION_KEY, JSON.stringify(nextState));
  };

  const clearResetSession = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.removeItem(RESET_SESSION_KEY);
  };

  const requestMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (_, variables) => {
      setVerifiedEmail(variables.email);
      otpForm.setValue('email', variables.email);
      resetForm.setValue('email', variables.email);
      setServerMessage('If that account exists, we just sent a 6-digit reset code to the email address.');
      setStep(2);
      persistResetSession({ email: variables.email, step: 2 });
    },
    onError: (error) => {
      setServerMessage(error.response?.data?.message || 'We could not start the password reset flow.');
    }
  });

  const otpMutation = useMutation({
    mutationFn: authApi.verifyResetOtp,
    onSuccess: (response, variables) => {
      setVerifiedEmail(variables.email);
      setVerifiedResetToken(response.data.resetToken);
      resetForm.setValue('email', variables.email);
      resetForm.setValue('resetToken', response.data.resetToken);
      setServerMessage('Code confirmed. You can set your new password now.');
      setStep(3);
      persistResetSession({
        email: variables.email,
        step: 3,
        resetToken: response.data.resetToken
      });
    },
    onError: (error) => {
      setServerMessage(error.response?.data?.message || 'That code could not be verified.');
    }
  });

  const resetMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      clearResetSession();
      navigate('/login', {
        state: {
          resetSuccess: 'Password updated successfully. Sign in with your new password.'
        }
      });
    },
    onError: (error) => {
      setServerMessage(error.response?.data?.message || 'We could not reset your password.');
    }
  });

  return (
    <AuthShell
      backTo="/login"
      backLabel="Back to sign in"
      badge={
        <>
          <Lock className="h-4 w-4" />
          Password recovery
        </>
      }
      title="Reset your password"
      description={
        step === 1
          ? 'Start with the email address on your account.'
          : step === 2
          ? 'Enter the 6-digit code we just sent to your inbox.'
          : 'Choose a new password for your account.'
      }
      asideTitle="Recover account access with a clear, secure reset flow."
      asideDescription="Request a one-time code, verify it, and set a stronger password without digging through a confusing process."
      asidePoints={[
        'Step 1: Request a password reset code.',
        'Step 2: Verify the code from your email.',
        'Step 3: Create a new password and sign back in.'
      ]}
    >
      <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
        <span className={step >= 1 ? 'text-primary-600 dark:text-primary-400' : ''}>Request</span>
        <span>*</span>
        <span className={step >= 2 ? 'text-primary-600 dark:text-primary-400' : ''}>Verify</span>
        <span>*</span>
        <span className={step >= 3 ? 'text-primary-600 dark:text-primary-400' : ''}>Reset</span>
      </div>

      {step === 1 && (
        <form onSubmit={requestForm.handleSubmit((data) => {
          setServerMessage('');
          requestMutation.mutate(data);
        })} className="space-y-6" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                {...requestForm.register('email')}
                type="email"
                className="input-field pl-11"
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck="false"
                disabled={requestMutation.isPending}
              />
            </div>
            {requestForm.formState.errors.email && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                <AlertCircle className="h-3 w-3" />
                {requestForm.formState.errors.email.message}
              </p>
            )}
          </div>

          {serverMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200">
              <AlertCircle className="h-4 w-4" />
              {serverMessage}
            </div>
          )}

          <button type="submit" disabled={requestMutation.isPending} className="btn-primary w-full py-3">
            {requestMutation.isPending ? <LoadingSpinner size="sm" className="text-white" /> : 'Send Reset Code'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={otpForm.handleSubmit((data) => {
          setServerMessage('');
          otpMutation.mutate(data);
        })} className="space-y-6" noValidate>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  {...otpForm.register('email')}
                  type="email"
                  className="input-field pl-11"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  disabled={otpMutation.isPending}
                />
              </div>
              {otpForm.formState.errors.email && (
                <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {otpForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Reset code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  {...otpForm.register('otp')}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="input-field pl-11 tracking-[0.35em]"
                  placeholder="123456"
                  maxLength={6}
                  disabled={otpMutation.isPending}
                />
              </div>
              {otpForm.formState.errors.otp && (
                <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {otpForm.formState.errors.otp.message}
                </p>
              )}
            </div>
          </div>

          {serverMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200">
              <AlertCircle className="h-4 w-4" />
              {serverMessage}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button type="submit" disabled={otpMutation.isPending} className="btn-primary w-full py-3">
              {otpMutation.isPending ? <LoadingSpinner size="sm" className="text-white" /> : 'Verify Reset Code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setServerMessage('');
                requestMutation.mutate({ email: otpForm.getValues('email') });
              }}
              disabled={requestMutation.isPending}
              className="btn-secondary w-full py-3"
            >
              Resend Code
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={resetForm.handleSubmit((data) => {
          setServerMessage('');
          resetMutation.mutate({ ...data, resetToken: verifiedResetToken || data.resetToken });
        })} className="space-y-6" noValidate>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  {...resetForm.register('email')}
                  type="email"
                  className="input-field pl-11"
                  value={verifiedEmail}
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  {...resetForm.register('password')}
                  type="password"
                  className="input-field pl-11"
                  autoComplete="new-password"
                  disabled={resetMutation.isPending}
                />
              </div>
              {resetForm.formState.errors.password && (
                <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {resetForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  {...resetForm.register('confirmPassword')}
                  type="password"
                  className="input-field pl-11"
                  autoComplete="new-password"
                  disabled={resetMutation.isPending}
                />
              </div>
              {resetForm.formState.errors.confirmPassword && (
                <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {resetForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>

          {serverMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200">
              <AlertCircle className="h-4 w-4" />
              {serverMessage}
            </div>
          )}

          <button type="submit" disabled={resetMutation.isPending} className="btn-primary w-full py-3">
            {resetMutation.isPending ? <LoadingSpinner size="sm" className="text-white" /> : 'Save New Password'}
          </button>
        </form>
      )}
    </AuthShell>
  );
};
