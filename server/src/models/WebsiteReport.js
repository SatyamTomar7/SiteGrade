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
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    effort: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    estimatedScoreImpact: { type: Number, min: 0, max: 100, default: 0 },
    issue: { type: String, default: '' },
    recommendation: { type: String, default: '' },
    expectedOutcome: { type: String, default: '' },
    rationale: { type: String, default: '' }
  }],
  aiFixes: [{
    title: { type: String, default: '' },
    category: { type: String, default: '' },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    effort: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    estimatedScoreImpact: { type: Number, min: 0, max: 100, default: 0 },
    suggestion: { type: String, default: '' },
    codeExample: { type: String, default: '' },
    whyItMatters: { type: String, default: '' }
  }],
  interviewSummary: {
    resumeBullets: [{ type: String }],
    projectDescription: { type: String, default: '' },
    techStackSummary: { type: String, default: '' },
    challengesSolved: [{ type: String }]
  }
}, { _id: false });

const reportCommentSchema = new mongoose.Schema({
  authorName: { type: String, default: '' },
  authorEmail: { type: String, default: '' },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const reportTaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  detail: { type: String, default: '' },
  assigneeName: { type: String, default: '' },
  assigneeEmail: { type: String, default: '' },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'done'],
    default: 'open'
  },
  severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: true });

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
    workspaceContext: {
      type: {
        workspaceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Workspace',
          default: null
        },
        workspaceName: {
          type: String,
          default: ''
        }
      },
      default: () => ({
        workspaceId: null,
        workspaceName: ''
      })
    },
    analysisConfig: {
      type: {
        scanMode: { type: String, enum: ['single', 'crawl'], default: 'single' },
        crawlMaxPages: { type: Number, min: 1, max: 25, default: 1 },
        auditProfiles: [{
          type: String,
          enum: ['mobile', 'desktop']
        }],
        competitorUrls: [{
          type: String,
          trim: true
        }],
        websiteType: {
          type: String,
          enum: ['auto', 'general', 'portfolio', 'saas', 'ecommerce', 'blog', 'docs', 'business'],
          default: 'auto'
        },
        enableFixMode: { type: Boolean, default: true }
      },
      default: () => ({
        scanMode: 'single',
        crawlMaxPages: 1,
        auditProfiles: ['mobile'],
        competitorUrls: [],
        websiteType: 'auto',
        enableFixMode: true
      })
    },
    scheduleContext: {
      type: {
        scheduleId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ScanSchedule',
          default: null
        },
        triggeredBy: {
          type: String,
          enum: ['manual', 'schedule'],
          default: 'manual'
        }
      },
      default: () => ({
        scheduleId: null,
        triggeredBy: 'manual'
      })
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
    crawlData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    benchmarkData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    fieldData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    siteProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    fixMode: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    collaboration: {
      type: {
        comments: {
          type: [reportCommentSchema],
          default: () => ([])
        },
        tasks: {
          type: [reportTaskSchema],
          default: () => ([])
        }
      },
      default: () => ({
        comments: [],
        tasks: []
      })
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
