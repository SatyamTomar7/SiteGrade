import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

export const RadarChartComponent = ({ scores }) => {
  const data = [
    { subject: 'Performance', A: scores.performance, fullMark: 100 },
    { subject: 'SEO', A: scores.seo, fullMark: 100 },
    { subject: 'Accessibility', A: scores.accessibility, fullMark: 100 },
    { subject: 'Security', A: scores.security, fullMark: 100 },
    { subject: 'Best Practices', A: scores.bestPractices, fullMark: 100 },
  ];

  return (
    <div className="card">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Category Breakdown</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            A quick visual view of how balanced the audit is across the five main scoring areas.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-dark-border dark:bg-dark-surface dark:text-slate-400">
          Higher and more even coverage usually means a healthier report.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="62%" data={data}>
              <PolarGrid stroke="#cbd5e1" strokeOpacity={0.5} />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickCount={6}
              />
              <Radar
                name="Score"
                dataKey="A"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="#3b82f6"
                fillOpacity={0.3}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {data.map((item) => (
            <div key={item.subject} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {item.subject}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{item.A ?? 0}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Out of 100</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
