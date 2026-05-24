const sanitize = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const buildList = (items = []) => {
  if (!items.length) {
    return '<p>None</p>';
  }

  return `<ul>${items.map((item) => `<li>${sanitize(item)}</li>`).join('')}</ul>`;
};

const defaultBranding = {
  brandName: 'SiteGrade',
  accentColor: '#2563eb',
  logoUrl: '',
  hideSiteGrade: false
};

export const buildReportHtml = (report, brandingOptions = {}) => {
  const scores = report.scores || {};
  const ai = report.aiReviewStructured || {};
  const branding = { ...defaultBranding, ...(brandingOptions || {}) };

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>SiteGrade Report - ${sanitize(report.url)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; line-height: 1.6; }
      h1, h2, h3 { margin-bottom: 8px; }
      .muted { color: #475569; }
      .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
      .brand-badge { width: 42px; height: 42px; border-radius: 12px; background: ${sanitize(branding.accentColor)}; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; }
      .brand-logo { max-height: 42px; max-width: 160px; object-fit: contain; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
      .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
      ul { padding-left: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    </style>
  </head>
  <body>
    <div class="brand">
      ${branding.logoUrl ? `<img src="${sanitize(branding.logoUrl)}" alt="${sanitize(branding.brandName)}" class="brand-logo" />` : `<div class="brand-badge">${sanitize((branding.brandName || 'S').slice(0, 1).toUpperCase())}</div>`}
      <div>
        <h1>${sanitize(branding.brandName)} Analysis Report</h1>
        ${branding.hideSiteGrade ? '' : '<p class="muted">Generated with SiteGrade</p>'}
      </div>
    </div>
    <p class="muted">${sanitize(report.url)}</p>
    <p><strong>Generated:</strong> ${sanitize(new Date(report.createdAt || Date.now()).toLocaleString())}</p>
    <p><strong>Grade:</strong> ${sanitize(ai.grade || 'N/A')}</p>
    <div class="grid">
      <div class="card"><strong>Performance</strong><br/>${sanitize(scores.performance ?? 0)}</div>
      <div class="card"><strong>SEO</strong><br/>${sanitize(scores.seo ?? 0)}</div>
      <div class="card"><strong>Accessibility</strong><br/>${sanitize(scores.accessibility ?? 0)}</div>
      <div class="card"><strong>Security</strong><br/>${sanitize(scores.security ?? 0)}</div>
      <div class="card"><strong>Best Practices</strong><br/>${sanitize(scores.bestPractices ?? 0)}</div>
      <div class="card"><strong>Overall Score</strong><br/>${sanitize(report.overallScore ?? 0)}</div>
    </div>
    <h2 style="color:${sanitize(branding.accentColor)}">Summary</h2>
    <p>${sanitize(report.aiReview || 'No AI review available.')}</p>
    <h2 style="color:${sanitize(branding.accentColor)}">Strengths</h2>
    ${buildList(ai.strengths)}
    <h2 style="color:${sanitize(branding.accentColor)}">Areas For Improvement</h2>
    ${buildList(ai.weaknesses)}
    <h2 style="color:${sanitize(branding.accentColor)}">Tech Stack</h2>
    ${buildList(report.techStack)}
    <h2 style="color:${sanitize(branding.accentColor)}">Score Breakdown</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th>Score</th></tr>
      </thead>
      <tbody>
        <tr><td>Performance</td><td>${sanitize(scores.performance ?? 0)}</td></tr>
        <tr><td>SEO</td><td>${sanitize(scores.seo ?? 0)}</td></tr>
        <tr><td>Accessibility</td><td>${sanitize(scores.accessibility ?? 0)}</td></tr>
        <tr><td>Security</td><td>${sanitize(scores.security ?? 0)}</td></tr>
        <tr><td>Best Practices</td><td>${sanitize(scores.bestPractices ?? 0)}</td></tr>
      </tbody>
    </table>
  </body>
  </html>`;
};

export const downloadReportHtml = (report, brandingOptions) => {
  const html = buildReportHtml(report, brandingOptions);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sitegrade-report-${new Date().toISOString().slice(0, 10)}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const printReport = (report, brandingOptions) => {
  const html = buildReportHtml(report, brandingOptions);
  const printWindow = window.open('', '_blank', 'width=1200,height=900');

  if (!printWindow) {
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
