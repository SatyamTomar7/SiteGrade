import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, KeyRound, Mail, RefreshCcw, ScanLine } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';
import { verifyEmailSchema } from '../utils/validators';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AuthShell } from '../components/AuthShell';

export const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [serverMessage, setServerMessage] = useState('');
  const presetEmail = location.state?.email || searchParams.get('email') || '';
  const redirectUrl = location.state?.redirectUrl || searchParams.get('redirect') || '/dashboard';
  const prefillUrl = location.state?.url || searchParams.get('url') || '';
  const loginToStore = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: presetEmail,
      otp: ''
    }
  });

  useEffect(() => {
    if (presetEmail) {
      setValue('email', presetEmail);
    }
  }, [presetEmail, setValue]);

  const watchedEmail = watch('email');

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (response) => {
      const { user, accessToken } = response.data;
      loginToStore(user, accessToken);

      if (prefillUrl) {
        navigate('/analysis', { state: { url: prefillUrl } });
        return;
      }

      navigate(redirectUrl);
    },
    onError: (error) => {
      setServerMessage(error.response?.data?.message || 'We could not verify that code. Please try again.');
    }
  });

  const resendMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: (response) => {
      setServerMessage(response.message || 'A new verification code has been sent.');
    },
    onError: (error) => {
      setServerMessage(error.response?.data?.message || 'We could not resend the code right now.');
    }
  });

  const onSubmit = (data) => {
    setServerMessage('');
    verifyMutation.mutate(data);
  };

  return (
    <AuthShell
      backTo="/login"
      backLabel="Back to sign in"
      badge={
        <>
          <Mail className="h-4 w-4" />
          Email verification
        </>
      }
      title="Verify your email"
      description="Enter the 6-digit code we sent to your inbox to activate your account."
      asideTitle="Confirm your email to unlock the full SiteGrade workflow."
      asideDescription="Email verification protects sign-ins, password recovery, and shared account activity without making the process hard to follow."
      asidePoints={[
        'Verification codes expire automatically for safer access.',
        'Verified accounts can recover passwords much more smoothly.',
        'This helps keep team sharing and report access more secure.'
      ]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register('email')}
                    type="email"
                    className="input-field pl-11"
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck="false"
                    disabled={verifyMutation.isPending || resendMutation.isPending}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Verification code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register('otp')}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="input-field pl-11 tracking-[0.35em]"
                    placeholder="123456"
                    maxLength={6}
                    disabled={verifyMutation.isPending}
                  />
                </div>
                {errors.otp && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                    <AlertCircle className="h-3 w-3" />
                    {errors.otp.message}
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

            <button type="submit" disabled={verifyMutation.isPending} className="btn-primary w-full py-3">
              {verifyMutation.isPending ? <LoadingSpinner size="sm" className="text-white" /> : 'Verify Email'}
            </button>

            <button
              type="button"
              onClick={() => {
                setServerMessage('');
                resendMutation.mutate({ email: watchedEmail });
              }}
              disabled={resendMutation.isPending || !watchedEmail}
              className="btn-secondary w-full py-3"
            >
              {resendMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4" />
                  Resend Code
                </>
              )}
            </button>
      </form>
    </AuthShell>
  );
};
