import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "framer-motion";
import { useAnalysis } from "../hooks/useAnalysis";
import { urlSchema } from "../utils/validators";
import { useAuthStore } from "../store/authStore";
import {
  ScanLine,
  Zap,
  Shield,
  Search,
  Eye,
  ArrowRight,
  Globe,
  AlertCircle,
} from "lucide-react";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { AIAnalysisLoader } from "../components/loaders/AIAnalysisLoader";

export const Landing = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { createAnalysisAsync, isCreating, createError } = useAnalysis();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTargetUrl, setCurrentTargetUrl] = useState("");
  const isMountedRef = useRef(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(urlSchema),
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onSubmit = async (data) => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: { redirectUrl: "/analysis", url: data.url },
      });
      return;
    }

    setCurrentTargetUrl(data.url);
    setIsGenerating(true);

    try {
      const response = await createAnalysisAsync(data.url);
      navigate(`/report/${response.data.jobId}`);
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const features = [
    {
      icon: <Zap className="h-6 w-6 text-amber-400" />,
      title: "Performance",
      description:
        "Analyze Core Web Vitals, rendering speed, and the issues slowing pages down.",
    },
    {
      icon: <Search className="h-6 w-6 text-sky-400" />,
      title: "SEO",
      description:
        "Check metadata, content structure, and search-readiness without digging through raw audits.",
    },
    {
      icon: <Eye className="h-6 w-6 text-violet-400" />,
      title: "Accessibility",
      description:
        "Review semantics, contrast, and assistive-technology support with clearer guidance.",
    },
    {
      icon: <Shield className="h-6 w-6 text-emerald-400" />,
      title: "Security",
      description:
        "Inspect headers, HTTPS setup, and common trust signals that affect production readiness.",
    },
  ];

  return (
    <>
      <AnimatePresence mode="wait">
        {isGenerating && (
          <AIAnalysisLoader
            key="landing-ai-analysis-loader"
            targetUrl={currentTargetUrl}
          />
        )}
      </AnimatePresence>

      {!isGenerating && (
        <div>
          <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pb-20 lg:px-8 lg:pt-14">
            <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_56%)] dark:bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.24),transparent_48%)]" />

            <div className="page-container">
              <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
                <div className="text-center lg:text-left">
                  <div className="section-kicker mb-6">
                    <Globe className="h-4 w-4" />
                    Analyze any website in seconds
                  </div>

                  <h1 className="section-title text-4xl sm:text-5xl lg:text-6xl">
                    Clear website audits that help you fix what matters next.
                  </h1>

                  <p className="section-copy mx-auto mt-6 max-w-2xl text-base sm:text-lg lg:mx-0">
                    SiteGrade turns performance, SEO, accessibility, and security
                    checks into reports your team can read quickly and act on with
                    confidence.
                  </p>

                  <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-2xl" noValidate>
                    <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-3 shadow-xl shadow-primary-100/40 backdrop-blur dark:border-dark-border dark:bg-dark-surface/90 dark:shadow-none">
                      <div className="flex flex-col gap-3 lg:flex-row">
                        <div className="relative flex-grow">
                          <Globe className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          <input
                            {...register("url")}
                            type="text"
                            placeholder="Enter website URL (e.g., https://example.com)"
                            className="input-field border-0 bg-slate-50/80 py-4 pl-12 text-base shadow-none dark:bg-slate-950/40 sm:text-lg"
                            disabled={isCreating}
                            inputMode="url"
                            autoComplete="url"
                            autoCapitalize="none"
                            spellCheck="false"
                            aria-invalid={errors.url ? "true" : "false"}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isCreating}
                          className="btn-primary min-h-[3.75rem] rounded-2xl px-8 text-base sm:text-lg"
                        >
                          {isCreating ? (
                            <LoadingSpinner size="sm" className="text-white" />
                          ) : (
                            <>
                              Analyze Now
                              <ArrowRight className="h-5 w-5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {errors.url && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-red-500" role="alert">
                        <AlertCircle className="h-4 w-4" />
                        {errors.url.message}
                      </div>
                    )}

                    {createError && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-red-500" role="alert">
                        <AlertCircle className="h-4 w-4" />
                        {createError.response?.data?.message ||
                          "Failed to start analysis"}
                      </div>
                    )}
                  </form>

                  <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
                    {[
                      ["Readability first", "Clean summaries and priority-based fixes."],
                      ["Team friendly", "Share reports, compare runs, and assign follow-up."],
                      ["Responsive by default", "Review audits comfortably on laptop or phone."],
                    ].map(([title, copy]) => (
                      <div
                        key={title}
                        className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-sm backdrop-blur dark:border-dark-border dark:bg-dark-surface/70"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {copy}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card relative overflow-hidden border-slate-200/70 bg-slate-950 text-white">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.35),transparent_35%)]" />
                  <div className="relative space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-primary-200">
                          What gets checked
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          A full technical review, not just a score.
                        </p>
                      </div>
                      <ScanLine className="h-10 w-10 rounded-2xl bg-white/10 p-2 text-primary-200" />
                    </div>

                    <div className="grid gap-3">
                      {features.map((feature) => (
                        <div
                          key={feature.title}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                        >
                          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                            {feature.icon}
                          </div>
                          <h3 className="text-lg font-semibold">{feature.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {feature.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="page-shell">
            <div className="page-container">
              <div className="mb-10 max-w-3xl">
                <div className="section-kicker mb-4">
                  <Eye className="h-4 w-4" />
                  Simple review flow
                </div>
                <h2 className="section-title text-3xl sm:text-4xl">
                  Understand the result fast, then move straight into fixes.
                </h2>
                <p className="section-copy mt-4">
                  Each report is organized around the questions teams actually ask:
                  what is broken, how severe it is, what changed, and what should
                  be fixed first.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {[
                  {
                    step: "01",
                    title: "Run an audit",
                    copy: "Start with one URL or a wider crawl, then choose mobile, desktop, or both.",
                  },
                  {
                    step: "02",
                    title: "Read the summary",
                    copy: "See scorecards, AI review notes, role coverage, comparisons, and visual snapshots in one place.",
                  },
                  {
                    step: "03",
                    title: "Take action",
                    copy: "Share results, export branded copies, and turn recommendations into follow-up tasks.",
                  },
                ].map((item) => (
                  <div key={item.step} className="card">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600 dark:text-primary-300">
                      {item.step}
                    </p>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      {item.copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
            <div className="page-container">
              <div className="card overflow-hidden border-slate-200/70 bg-slate-900 text-white dark:bg-slate-950">
                <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="section-kicker mb-4 border-white/15 bg-white/10 text-primary-100 dark:border-white/10 dark:bg-white/10">
                      <ScanLine className="h-4 w-4" />
                      Ready when you are
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                      Ready to optimize your website?
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                      Start with a single URL, get a readable audit, and turn it
                      into a cleaner, faster, more trustworthy experience on every
                      screen size.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                  >
                    <ScanLine className="h-5 w-5" />
                    Start Analyzing
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
