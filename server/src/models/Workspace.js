import mongoose from 'mongoose';
import crypto from 'crypto';

const workspaceMemberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'editor', 'viewer'],
    default: 'viewer'
  },
  status: {
    type: String,
    enum: ['invited', 'active'],
    default: 'invited'
  },
  inviteToken: {
    type: String,
    default: ''
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date,
    default: null
  }
}, { _id: true });

const workspaceSchema = new mongoose.Schema({
  ownerId: {
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
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  members: {
    type: [workspaceMemberSchema],
    default: () => ([])
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

workspaceSchema.index({ ownerId: 1, createdAt: -1 });
workspaceSchema.index({ 'members.email': 1 });
workspaceSchema.index({ 'members.inviteToken': 1 });

workspaceSchema.methods.createInviteToken = function () {
  return crypto.randomBytes(18).toString('hex');
};

export const Workspace = mongoose.model('Workspace', workspaceSchema);
