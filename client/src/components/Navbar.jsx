import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ScanLine, Moon, Sun, LogOut, User, Menu, X, LayoutDashboard, Search } from 'lucide-react';
import { useState, useEffect } from 'react';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const storedTheme = window.localStorage.getItem('sitegrade-theme');

    if (storedTheme) {
      return storedTheme === 'dark';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const storedTheme = window.localStorage.getItem('sitegrade-theme');

    if (storedTheme) {
      return undefined;
    }

    const syncTheme = (event) => setIsDark(event.matches);
    mediaQuery.addEventListener('change', syncTheme);

    return () => {
      mediaQuery.removeEventListener('change', syncTheme);
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      window.localStorage.setItem('sitegrade-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      window.localStorage.setItem('sitegrade-theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  const toggleDarkMode = () => setIsDark((prev) => !prev);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/75 backdrop-blur-xl dark:border-dark-border dark:bg-dark-bg/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[4.5rem] items-center justify-between gap-3 py-3">
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-primary-600">
              <ScanLine className="h-5 w-5 transition-transform group-hover:scale-110" />
            </span>
            <span className="min-w-0">
              <span className="block truncate bg-gradient-to-r from-slate-950 via-primary-700 to-primary-500 bg-clip-text text-lg font-bold text-transparent sm:text-xl dark:from-white dark:via-primary-300 dark:to-primary-500">
                SiteGrade
              </span>
              <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
                Website audits made clear
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated && (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm dark:border-dark-border dark:bg-dark-surface/80">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  to="/analysis"
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Search className="h-4 w-4" />
                  New Analysis
                </Link>
              </div>
            )}

            <button
              onClick={toggleDarkMode}
              className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm dark:border-dark-border dark:bg-dark-surface/80 dark:text-slate-300 lg:flex">
                  <User className="h-4 w-4" />
                  <span className="max-w-[11rem] truncate">{user?.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-dark-surface"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-500"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition-colors hover:bg-slate-100 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="border-t border-slate-200/80 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-xl dark:border-dark-border dark:bg-dark-bg/95 md:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            <button
              onClick={toggleDarkMode}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200"
            >
              <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {isAuthenticated ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-dark-border dark:bg-dark-surface dark:text-slate-300">
                  Signed in as <span className="break-words font-semibold text-slate-900 dark:text-white">{user?.name}</span>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  to="/analysis"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200"
                >
                  <Search className="h-4 w-4" />
                  New Analysis
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 font-medium text-red-600 dark:bg-red-900/20 dark:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center font-medium text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-200"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-center font-medium text-white dark:bg-primary-600"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
