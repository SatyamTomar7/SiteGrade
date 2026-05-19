import { Cpu } from 'lucide-react';

export const TechBadge = ({ tech }) => {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
      <Cpu className="w-3.5 h-3.5" />
      {tech}
    </span>
  );
};