import mongoose from 'mongoose';
import crypto from 'crypto';

const deployHookSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
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
  token: {
    type: String,
    unique: true,
    index: true
  },
  active: {
    type: Boolean,
    default: true
  },
  lastTriggeredAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

deployHookSchema.pre('validate', function () {
  if (!this.token) {
    this.token = crypto.randomBytes(18).toString('hex');
  }
});

export const DeployHook = mongoose.model('DeployHook', deployHookSchema);
