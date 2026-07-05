import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { loginSchema } from '../utils/validators';
import { ScanLine, Mail, Lock, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AuthShell } from '../components/AuthShell';

export const Login = () => {
  const { login, isLoading, error, errorCode, clearError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectUrl = location.state?.redirectUrl || '/';
  const prefillUrl = location.state?.url;
  const resetSuccess = location.state?.resetSuccess;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: location.state?.email || ''
    }
  });
  const watchedEmail = watch('email');

  const onSubmit = (data) => {
    clearError();
    login(data, {
      onSuccess: () => {
        if (prefillUrl) {
          navigate('/analysis', { state: { url: prefillUrl } });
        } else {
          navigate(redirectUrl);
        }
      }
    });
  };

  return (
    <AuthShell
      backTo="/"
      backLabel="Back to home"
      badge={
        <>
          <ScanLine className="h-4 w-4" />
          Sign in
        </>
      }
      title="Welcome back"
      description="Sign in to review saved audits, compare changes, and keep website fixes moving."
      asideTitle="Pick up right where your last audit left off."
      asideDescription="Everything stays in one place so you can open reports quickly, understand what changed, and move straight into action."
      asidePoints={[
        'Revisit saved reports and exports without hunting through older runs.',
        'Spot regressions faster by comparing two completed scans side by side.',
        'Manage recurring scans, team follow-up, and shared results from one dashboard.'
      ]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    {...register('email')}
                    type="email"
                    className="input-field pl-11"
                    placeholder="you@example.com"
                    disabled={isLoading}
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck="false"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    {...register('password')}
                    type="password"
                    className="input-field pl-11"
                    placeholder="********"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {resetSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                {resetSuccess}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400" role="alert">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-end">
              <Link
                to={`/forgot-password${watchedEmail ? `?email=${encodeURIComponent(watchedEmail)}` : ''}`}
                className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" className="text-white" />
              ) : (
                'Sign In'
              )}
            </button>

            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              Don't have an account?{' '}
              <Link 
                to="/register" 
                state={{ redirectUrl, url: prefillUrl }}
                className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                Get started
              </Link>
            </p>

            {errorCode === 'EMAIL_NOT_VERIFIED' && watchedEmail && (
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                Need to finish verification?{' '}
                <Link
                  to={`/verify-email?email=${encodeURIComponent(watchedEmail)}&redirect=${encodeURIComponent(redirectUrl)}${prefillUrl ? `&url=${encodeURIComponent(prefillUrl)}` : ''}`}
                  state={{ email: watchedEmail, redirectUrl, url: prefillUrl }}
                  className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  Enter your email code
                </Link>
              </p>
            )}
      </form>
    </AuthShell>
  );
};

