import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const getScoreColor = (score) => {
  if (score >= 90) return "text-emerald-500 dark:text-emerald-400";
  if (score >= 70) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
};

const getScoreBg = (score) => {
  if (score >= 90)
    return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800";
  if (score >= 70)
    return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
};

const getScoreRing = (score) => {
  if (score >= 90) return "stroke-emerald-500 dark:stroke-emerald-400";
  if (score >= 70) return "stroke-amber-500 dark:stroke-amber-400";
  return "stroke-red-500 dark:stroke-red-400";
};

export const ScoreCard = ({ title, score, icon, description }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      className={cn(
        "card border-2 transition-all duration-300 hover:shadow-md",
        getScoreBg(score)
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-white/50 dark:bg-dark-bg/50">
          {icon}
        </div>

        <div className="relative w-20 h-20">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-200 dark:text-slate-700"
            />

            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(
                "transition-all duration-1000 ease-out",
                getScoreRing(score)
              )}
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-lg font-bold", getScoreColor(score))}>
              {score}
            </span>
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
};