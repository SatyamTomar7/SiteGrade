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
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Score Overview</h3>
      <div className="w-full h-72 sm:h-80">
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
    </div>
  );
};
