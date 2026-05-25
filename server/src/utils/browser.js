import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { logger } from '../config/logger.js';

const isEnabled = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const shouldReusePuppeteerBrowser = isEnabled(process.env.PUPPETEER_REUSE_BROWSER, true);
const isWindows = process.platform === 'win32';
const isVercel = isEnabled(process.env.VERCEL, false) || isEnabled(process.env.VERCEL_ENV, false);

let sharedBrowserPromise = null;

const windowsChromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
].filter(Boolean);

const linuxChromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
].filter(Boolean);

const getChromeCandidates = () => (isWindows ? windowsChromeCandidates : linuxChromeCandidates);

const firstExistingPath = (candidates = []) => candidates.find((candidate) => {
  try {
    return Boolean(candidate) && fs.existsSync(candidate);
  } catch {
    return false;
  }
});

export const getChromeExecutablePath = async () => {
  const configuredPath = firstExistingPath(getChromeCandidates());
  if (configuredPath) {
    return configuredPath;
  }

  try {
    const bundledPath = await Promise.resolve(puppeteer.executablePath());
    if (bundledPath && fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch (error) {
    logger.warn('Bundled Puppeteer Chrome path lookup failed', {
      message: error.message
    });
  }

  const error = new Error(
    isVercel
      ? 'Chrome executable not found. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH for this deployment.'
      : 'Chrome executable not found. Install Chrome or set PUPPETEER_EXECUTABLE_PATH/CHROME_PATH.'
  );
  error.code = 'CHROME_PATH_NOT_FOUND';
  throw error;
};

export const getBrowserLaunchArgs = () => {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-breakpad',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter',
    '--disable-ipc-flooding-protection',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--mute-audio',
    '--no-first-run',
    '--no-zygote',
    '--window-size=1920,1080'
  ];

  return args;
};

const createBrowser = async () => {
  const executablePath = await getChromeExecutablePath();

  logger.info('Launching shared Puppeteer browser', {
    executablePath,
    platform: process.platform,
    vercel: isVercel
  });

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: getBrowserLaunchArgs()
  });
};

export const getPuppeteerBrowser = async () => {
  if (!shouldReusePuppeteerBrowser) {
    return createBrowser();
  }

  if (!sharedBrowserPromise) {
    sharedBrowserPromise = createBrowser().then((browser) => {
      browser.on('disconnected', () => {
        sharedBrowserPromise = null;
      });

      return browser;
    }).catch((error) => {
      sharedBrowserPromise = null;
      throw error;
    });
  }

  return sharedBrowserPromise;
};

export const closeSharedPuppeteerBrowser = async () => {
  if (!sharedBrowserPromise) {
    return;
  }

  sharedBrowserPromise = null;

  try {
    const browser = await sharedBrowserPromise;
    await browser.close();
  } catch (error) {
    logger.warn('Failed to close shared Puppeteer browser', {
      message: error.message
    });
  }
};
