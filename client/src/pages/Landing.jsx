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
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title: "Performance",
      description:
        "Analyze Core Web Vitals, load times, and rendering performance.",
    },
    {
      icon: <Search className="w-6 h-6 text-blue-500" />,
      title: "SEO",
      description:
        "Check meta tags, structured data, and search engine optimization.",
    },
    {
      icon: <Eye className="w-6 h-6 text-purple-500" />,
      title: "Accessibility",
      description:
        "Validate ARIA labels, contrast ratios, and screen reader compatibility.",
    },
    {
      icon: <Shield className="w-6 h-6 text-emerald-500" />,
      title: "Security",
      description:
        "Inspect headers, HTTPS configuration, and vulnerability patterns.",
    },
  ];

  return (
    <>
      <AnimatePresence mode="wait">
        {isGenerating && (
          <AIAnalysisLoader key="landing-ai-analysis-loader" targetUrl={currentTargetUrl} />
        )}
      </AnimatePresence>

      {!isGenerating && (
        <div>
          {/* Hero Section */}
          <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white dark:from-dark-bg dark:to-dark-bg py-20 lg:py-32">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-8">
                <Globe className="w-4 h-4" />
                Analyze any website in seconds
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight mb-6">
                <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
                  Analyze. Optimize.
                </span>
                <br />
                <span className="text-slate-900 dark:text-white">
                  Dominate Search.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-12">
                Get comprehensive insights into your website&apos;s performance, SEO,
                accessibility, and security with our advanced analysis engine.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-grow">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      {...register("url")}
                      type="text"
                      placeholder="Enter website URL (e.g., https://example.com)"
                      className="input-field pl-12 py-4 text-lg"
                      disabled={isCreating}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="btn-primary py-4 px-8 text-lg whitespace-nowrap"
                  >
                    {isCreating ? (
                      <LoadingSpinner size="sm" className="text-white" />
                    ) : (
                      <>
                        Analyze Now
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </button>
                </div>

                {errors.url && (
                  <div className="flex items-center gap-2 mt-3 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {errors.url.message}
                  </div>
                )}

                {createError && (
                  <div className="flex items-center gap-2 mt-3 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {createError.response?.data?.message ||
                      "Failed to start analysis"}
                  </div>
                )}
              </form>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20 bg-white dark:bg-dark-bg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                  Comprehensive Analysis
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                  Our engine checks every critical aspect of your website to ensure
                  peak performance.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="card hover:shadow-lg transition-shadow duration-300"
                  >
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-dark-surface w-fit mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 bg-primary-600 dark:bg-primary-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to optimize your website?
              </h2>
              <p className="text-primary-100 text-lg mb-8">
                Join thousands of developers who trust SiteGrade for their website
                analysis needs.
              </p>
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white text-primary-700 font-semibold hover:bg-primary-50 transition-colors"
              >
                <ScanLine className="w-5 h-5" />
                Start Analyzing
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
