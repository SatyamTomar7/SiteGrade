import crypto from 'node:crypto';
import { SqlModel } from './_sqlModel.js';

export const WebsiteReport = new SqlModel({
  tableName: 'website_reports',
  jsonFields: [
    'workspaceContext',
    'analysisConfig',
    'scheduleContext',
    'scores',
    'aiReviewStructured',
    'lighthouseData',
    'puppeteerData',
    'crawlData',
    'benchmarkData',
    'fieldData',
    'siteProfile',
    'fixMode',
    'collaboration',
    'techStack'
  ],
  defaultSort: { createdAt: -1 },
  defaults: {
    workspaceContext: { workspaceId: null, workspaceName: '' },
    analysisConfig: {
      scanMode: 'single',
      crawlMaxPages: 1,
      auditProfiles: ['mobile'],
      competitorUrls: [],
      websiteType: 'auto',
      enableFixMode: true
    },
    scheduleContext: { scheduleId: null, triggeredBy: 'manual' },
    scores: { performance: 0, seo: 0, accessibility: 0, security: 0, bestPractices: 0 },
    aiReview: '',
    aiReviewStructured: {},
    lighthouseData: {},
    puppeteerData: {},
    crawlData: {},
    benchmarkData: {},
    fieldData: {},
    siteProfile: {},
    fixMode: {},
    collaboration: { comments: [], tasks: [] },
    techStack: [],
    status: 'pending',
    overallScore: 0,
    isPublic: false,
    errorMessage: null,
    sharedAt: null,
    completedAt: null,
    failedAt: null
  },
  beforeSave: async (data) => ({
    ...data,
    collaboration: {
      comments: (Array.isArray(data.collaboration?.comments) ? data.collaboration.comments : []).map((comment) => ({
        _id: comment._id || comment.id || crypto.randomUUID(),
        ...comment
      })),
      tasks: (Array.isArray(data.collaboration?.tasks) ? data.collaboration.tasks : []).map((task) => ({
        _id: task._id || task.id || crypto.randomUUID(),
        ...task
      }))
    }
  }),
  decorateDocument(document) {
    Object.defineProperty(document, 'ensureShareToken', {
      enumerable: false,
      value() {
        if (!this.publicShareToken) {
          this.publicShareToken = crypto.randomBytes(18).toString('hex');
        }

        return this.publicShareToken;
      }
    });
  }
});
