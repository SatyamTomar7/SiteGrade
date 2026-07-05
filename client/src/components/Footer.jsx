import { ScanLine, ArrowRight, LayoutDashboard, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="border-t border-slate-200/80 bg-white/80 backdrop-blur-sm dark:border-dark-border dark:bg-dark-surface/70">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="card border-slate-200/70 bg-gradient-to-br from-white to-slate-50 dark:from-dark-surface dark:to-slate-900">
            <Link to="/" className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-primary-600">
                <ScanLine className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-lg font-bold text-slate-900 dark:text-white">SiteGrade</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">Fast, readable website audits</span>
              </span>
            </Link>
            <p className="max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Review performance, SEO, accessibility, and implementation quality in one place, then turn findings into fixes your team can actually ship.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Clear reports', 'Readable summaries and quick priorities.'],
                ['Built for teams', 'Compare runs, share results, and plan follow-up.'],
                ['Responsive UI', 'Comfortable to review on phones and laptops.']
              ].map(([title, copy]) => (
                <div key={title} className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 text-sm dark:border-dark-border dark:bg-dark-bg/60">
                  <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{copy}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/analysis" className="btn-primary">
                Start an audit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/dashboard" className="btn-secondary">
                <LayoutDashboard className="h-4 w-4" />
                Open dashboard
              </Link>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Explore</h3>
            <div className="space-y-3 text-sm">
              <Link to="/" className="flex items-center gap-2 text-slate-700 transition-colors hover:text-primary-600 dark:text-slate-200 dark:hover:text-primary-300">
                <Search className="h-4 w-4" />
                Analyze a site
              </Link>
              <Link to="/dashboard" className="flex items-center gap-2 text-slate-700 transition-colors hover:text-primary-600 dark:text-slate-200 dark:hover:text-primary-300">
                <LayoutDashboard className="h-4 w-4" />
                Reports dashboard
              </Link>
              <Link to="/register" className="flex items-center gap-2 text-slate-700 transition-colors hover:text-primary-600 dark:text-slate-200 dark:hover:text-primary-300">
                <ShieldCheck className="h-4 w-4" />
                Create account
              </Link>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">What You Get</h3>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Clear scoring across performance, SEO, accessibility, security, and best practices.</p>
              <p>Shareable reports, comparisons, recurring scans, and implementation follow-up tools.</p>
              <p>Responsive layouts that stay readable from phones to large desktops.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200/80 px-2 pt-6 text-center text-sm text-slate-500 dark:border-dark-border dark:text-slate-400">
          Copyright {new Date().getFullYear()} SiteGrade. Built for faster website reviews.
        </div>
      </div>
    </footer>
  );
};
