import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { registerSchema } from '../utils/validators';
import { ScanLine, User, Mail, Lock, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AuthShell } from '../components/AuthShell';

export const Register = () => {
  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectUrl = location.state?.redirectUrl || '/';
  const prefillUrl = location.state?.url;

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = (data) => {
    clearError();
    const verificationParams = new URLSearchParams({
      email: data.email,
      redirect: redirectUrl
    });

    if (prefillUrl) {
      verificationParams.set('url', prefillUrl);
    }

    registerUser(data, {
      onSuccess: () => {
        navigate(`/verify-email?${verificationParams.toString()}`, {
          state: {
            email: data.email,
            redirectUrl,
            url: prefillUrl
          }
        });
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
          Create account
        </>
      }
      title="Create your account"
      description="Start analyzing websites in minutes with a simpler, easier-to-follow workflow."
      asideTitle="Start with a cleaner website review workflow."
      asideDescription="Create an account to save reports, compare progress over time, and turn technical findings into clear follow-up work."
      asidePoints={[
        'Keep every audit in one responsive dashboard that is easier to scan.',
        'Share readable reports with teammates, clients, or stakeholders.',
        'Turn findings into tasks, comments, exports, and next steps faster.'
      ]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    {...register('name')}
                    type="text"
                    className="input-field pl-11"
                    placeholder="John Doe"
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.name.message}
                  </p>
                )}
              </div>

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
                    autoComplete="new-password"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password.message}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Use at least 8 characters, including uppercase, lowercase, and a number.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    {...register('confirmPassword')}
                    type="password"
                    className="input-field pl-11"
                    placeholder="********"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-red-500" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400" role="alert">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" className="text-white" />
              ) : (
                'Create Account'
              )}
            </button>

            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              Already have an account?{' '}
              <Link 
                to="/login" 
                state={{ redirectUrl, url: prefillUrl }}
                className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                Sign in
              </Link>
            </p>
            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              Need to finish a signup?{' '}
              <Link
                to={prefillUrl
                  ? `/verify-email?url=${encodeURIComponent(prefillUrl)}&redirect=${encodeURIComponent(redirectUrl)}`
                  : `/verify-email?redirect=${encodeURIComponent(redirectUrl)}`}
                className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                Verify your email
              </Link>
            </p>
      </form>
    </AuthShell>
  );
};

