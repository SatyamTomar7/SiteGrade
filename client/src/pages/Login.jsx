import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { loginSchema } from '../utils/validators';
import { ScanLine, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Login = () => {
  const { login, isLoading, error, clearError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectUrl = location.state?.redirectUrl || '/';
  const prefillUrl = location.state?.url;

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema)
  });

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
    <div className="page-shell flex items-center justify-center">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card hidden lg:flex lg:flex-col lg:justify-between lg:bg-slate-950 lg:text-white">
          <div>
            <div className="section-kicker mb-6 border-white/10 bg-white/10 text-primary-100 dark:bg-white/10">
              <ScanLine className="h-4 w-4" />
              Sign in
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Pick up right where your last audit left off.</h1>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              Review saved reports, compare runs, share results, and keep your website fixes moving without losing context.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              'Revisit analysis history and exported reports',
              'Compare two completed runs to spot regressions',
              'Manage recurring scans, alerts, and team follow-up'
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card mx-auto w-full max-w-md space-y-6 sm:space-y-8 lg:max-w-none">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2 mb-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
            <div className="flex justify-center mb-4">
              <ScanLine className="w-12 h-12 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Welcome back
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Sign in to your SiteGrade account
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
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
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
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
          </form>
        </div>
      </div>
    </div>
  );
};

