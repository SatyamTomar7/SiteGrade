import { memo, useMemo } from 'react';
import './AIAnalysisLoader.css';

const extractDomain = (targetUrl) => {
  if (!targetUrl) {
    return 'Preparing target...';
  }

  try {
    const normalized = /^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`;
    return new URL(normalized).hostname;
  } catch {
    return targetUrl;
  }
};

export const AIAnalysisLoader = memo(({ targetUrl = '', progress = 0 }) => {
  const domain = useMemo(() => extractDomain(targetUrl), [targetUrl]);
  const safeProgress = Math.min(Math.max(Number(progress) || 0, 0), 100);

  return (
    <section className="ai-analysis-loader">
      <div className="ai-analysis-loader__card">
        <p className="ai-analysis-loader__label">Report analysis in progress</p>
        <div className="ai-analysis-loader__percent">{Math.round(safeProgress)}%</div>
        <div className="ai-analysis-loader__track" aria-hidden="true">
          <div
            className="ai-analysis-loader__fill"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
        <p className="ai-analysis-loader__domain">{domain}</p>
      </div>
    </section>
  );
});

AIAnalysisLoader.displayName = 'AIAnalysisLoader';
