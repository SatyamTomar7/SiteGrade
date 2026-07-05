import { SqlModel } from './_sqlModel.js';

export const ScanSchedule = new SqlModel({
  tableName: 'scan_schedules',
  jsonFields: ['analysisConfig', 'deliveryChannels'],
  defaultSort: { createdAt: -1 },
  defaults: {
    analysisConfig: {},
    frequency: 'weekly',
    active: true,
    lastRunAt: null,
    lastReportId: null,
    lastStatus: 'idle',
    deliveryChannels: [
      { type: 'in_app', enabled: true, target: '' }
    ],
    lastAlertSummary: ''
  }
});
