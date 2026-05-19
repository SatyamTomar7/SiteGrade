import mongoose from 'mongoose';
import crypto from 'crypto';

const scoreSchema = new mongoose.Schema({
  performance: { type: Number, default: 0, min: 0, max: 100 },
  seo: { type: Number, default: 0, min: 0, max: 100 },
  accessibility: { type: Number, default: 0, min: 0, max: 100 },
  security: { type: Number, default: 0, min: 0, max: 100 },
  bestPractices: { type: Number, default: 0, min: 0, max: 100 }
}, { _id: false });

const aiReviewStructuredSchema = new mongoose.Schema({
  grade: { type: String, enum: ['A+', 'A', 'B', 'C', 'D'], default: 'C' },
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  portfolioReadiness: {
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    visualPolish: { type: Number, min: 0, max: 100, default: 0 },
    trustProfessionalism: { type: Number, min: 0, max: 100, default: 0 },
    projectClarity: { type: Number, min: 0, max: 100, default: 0 },
    contactClarity: { type: Number, min: 0, max: 100, default: 0 },
    mobileReadiness: { type: Number, min: 0, max: 100, default: 0 },
    hiringImpression: { type: Number, min: 0, max: 100, default: 0 },
    summary: { type: String, default: '' }
  },
  recruiterMode: {
    hiringSignal: { type: String, default: '' },
    recruiterVerdict: { type: String, default: '' },
    resumePitch: { type: String, default: '' }
  },
  actionPlan: [{
    priority: { type: String, enum: ['Quick Win', 'High Impact', 'Must Fix'], default: 'High Impact' },
    issue: { type: String, default: '' },
    recommendation: { type: String, default: '' },
    expectedOutcome: { type: String, default: '' }
  }],
  aiFixes: [{
    title: { type: String, default: '' },
    category: { type: String, default: '' },
    suggestion: { type: String, default: '' },
    codeExample: { type: String, default: '' }
  }],
  interviewSummary: {
    resumeBullets: [{ type: String }],
    projectDescription: { type: String, default: '' },
    techStackSummary: { type: String, default: '' },
    challengesSolved: [{ type: String }]
  }
}, { _id: false });

const websiteReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    url: {
      type: String,
      required: [true, 'URL is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    scores: {
      type: scoreSchema,
      default: () => ({})
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true
    },
    aiReview: {
      type: String,
      default: ''
    },
    aiReviewStructured: {
      type: aiReviewStructuredSchema,
      default: () => ({})
    },
    lighthouseData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    puppeteerData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    techStack: [{
      type: String,
      trim: true
    }],
    errorMessage: {
      type: String,
      default: null
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true
    },
    publicShareToken: {
      type: String,
      default: undefined
    },
    sharedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    failedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

websiteReportSchema.index({ createdAt: -1 });
websiteReportSchema.index({ userId: 1, createdAt: -1 });
websiteReportSchema.index({ status: 1, createdAt: -1 });
websiteReportSchema.index({ userId: 1, overallScore: -1, createdAt: -1 });
websiteReportSchema.index(
  { publicShareToken: 1 },
  {
    unique: true,
    partialFilterExpression: {
      publicShareToken: { $exists: true, $type: 'string' }
    }
  }
);

websiteReportSchema.methods.ensureShareToken = function () {
  if (!this.publicShareToken) {
    this.publicShareToken = crypto.randomBytes(18).toString('hex');
  }

  return this.publicShareToken;
};

export const WebsiteReport = mongoose.model('WebsiteReport', websiteReportSchema);
