import { Link } from 'react-router-dom';
import { ArrowLeft, ScanLine } from 'lucide-react';

export const AuthShell = ({
  backTo = '/',
  backLabel = 'Back',
  badge,
  title,
  description,
  asideTitle,
  asideDescription,
  asidePoints = [],
  children
}) => {
  return (
    <div className="page-shell flex items-center justify-center">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_0.96fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.32),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                  <ScanLine className="h-6 w-6 text-primary-200" />
                </span>
                <div>
                  <p className="text-lg font-semibold">SiteGrade</p>
                  <p className="text-sm text-slate-300">Simple website reviews, clearer next steps.</p>
                </div>
              </div>

              {badge && (
                <div className="section-kicker mb-6 border-white/10 bg-white/10 text-primary-100">
                  {badge}
                </div>
              )}

              <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                {asideTitle}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                {asideDescription}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {asidePoints.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-200 backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card mx-auto flex w-full max-w-xl flex-col justify-center rounded-[2rem] p-6 sm:p-8">
          <div className="mb-8 text-center">
            <Link
              to={backTo}
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
            <div className="mb-4 flex justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
                <ScanLine className="h-7 w-7" />
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
              {description}
            </p>
          </div>

          {children}
        </section>
      </div>
    </div>
  );
};
