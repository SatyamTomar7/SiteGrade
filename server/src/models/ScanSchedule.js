import mongoose from 'mongoose';

const deliveryChannelSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['in_app', 'email', 'slack'],
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  target: {
    type: String,
    default: ''
  }
}, { _id: false });

const scanScheduleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  analysisConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly'],
    default: 'weekly'
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  nextRunAt: {
    type: Date,
    required: true,
    index: true
  },
  lastRunAt: {
    type: Date,
    default: null
  },
  lastReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WebsiteReport',
    default: null
  },
  lastStatus: {
    type: String,
    enum: ['idle', 'queued', 'processing', 'completed', 'failed'],
    default: 'idle'
  },
  deliveryChannels: {
    type: [deliveryChannelSchema],
    default: () => ([
      { type: 'in_app', enabled: true, target: '' }
    ])
  },
  lastAlertSummary: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

scanScheduleSchema.index({ userId: 1, active: 1, nextRunAt: 1 });

export const ScanSchedule = mongoose.model('ScanSchedule', scanScheduleSchema);
