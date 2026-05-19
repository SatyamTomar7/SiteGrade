import { ScanLine, Github, Twitter, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="bg-slate-50 dark:bg-dark-surface border-t border-slate-200 dark:border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <ScanLine className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              <span className="text-lg font-bold text-slate-900 dark:text-white">SiteGrade</span>
            </Link>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm">
              Professional website analysis and optimization platform.
              Get deep insights into your site's performance, SEO, accessibility, and security.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Product</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400">Analyze</Link></li>
              <li><span className="text-slate-600 dark:text-slate-400">Pricing</span></li>
              <li><span className="text-slate-600 dark:text-slate-400">API</span></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Connect</h3>
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-dark-border px-2 text-center text-sm text-slate-500 dark:text-slate-500">
          (c) {new Date().getFullYear()} SiteGrade. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
