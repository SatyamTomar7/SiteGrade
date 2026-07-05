import { Buffer } from 'node:buffer';
import { logger } from '../config/logger.js';
import { createAppError } from '../utils/appError.js';

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const normalizeConfigValue = (value) => value?.trim();
const normalizeEmailAddress = (value) => value?.trim().toLowerCase();

const getMailConfig = () => {
  const senderEmail = normalizeEmailAddress(process.env.EMAIL_MY_EMAIL || process.env.GMAIL_SENDER_EMAIL);

  return {
    clientId: normalizeConfigValue(process.env.EMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_ID),
    clientSecret: normalizeConfigValue(process.env.EMAIL_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET),
    refreshToken: normalizeConfigValue(process.env.EMAIL_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN),
    senderEmail,
    senderName: normalizeConfigValue(process.env.GMAIL_SENDER_NAME) || 'SiteGrade'
  };
};

export const isEmailDeliveryConfigured = () => {
  const config = getMailConfig();
  return Object.values(config).every(Boolean);
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const sanitizeEmailTemplateValue = (value) => escapeHtml(value ?? '');

const stripHtml = (value) =>
  String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const assertValidMailConfig = ({ senderEmail }) => {
  if (!senderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    throw createAppError(
      'Email delivery is misconfigured. Set EMAIL_MY_EMAIL to the Gmail account or a valid Gmail send-as alias.',
      500,
      'EMAIL_CONFIGURATION_INVALID'
    );
  }
};

const buildMimeMessage = ({ to, subject, html, text, senderEmail, senderName }) => {
  const boundary = `sitegrade-${Date.now().toString(36)}`;
  const headers = [
    `From: ${senderName} <${senderEmail}>`,
    `To: ${to}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `Subject: ${subject}`
  ];

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
    `--${boundary}--`
  ].join('\r\n');

  return `${headers.join('\r\n')}\r\n\r\n${body}`;
};

const base64UrlEncode = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const getGmailAccessToken = async () => {
  const { clientId, clientSecret, refreshToken } = getMailConfig();
  const response = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    logger.error('Failed to obtain Gmail access token', {
      status: response.status,
      responseText
    });
    throw createAppError(
      'Email delivery failed. Check your Google OAuth client, refresh token, Gmail API access, and sender address.',
      503,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  const data = await response.json();
  return data.access_token;
};

export const sendEmail = async ({ to, subject, html }) => {
  if (!isEmailDeliveryConfigured()) {
    logger.warn('Email delivery skipped because Gmail API credentials are not configured', { to, subject });
    return { skipped: true };
  }

  const { senderEmail, senderName } = getMailConfig();
  assertValidMailConfig({ senderEmail });
  const accessToken = await getGmailAccessToken();
  const text = stripHtml(html);
  const raw = base64UrlEncode(buildMimeMessage({ to, subject, html, text, senderEmail, senderName }));

  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!response.ok) {
    const responseText = await response.text();
    logger.error('Gmail message send failed', {
      to,
      subject,
      status: response.status,
      responseText
    });
    throw createAppError(
      'Email delivery failed. Check your Google OAuth client, refresh token, Gmail API access, and sender address.',
      503,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  return response.json();
};
