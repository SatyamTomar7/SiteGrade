import puppeteer from 'puppeteer';

const isEnabled = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const shouldReusePuppeteerBrowser = isEnabled(process.env.PUPPETEER_REUSE_BROWSER, true);

let sharedBrowserPromise = null;

export const getChromeExecutablePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return puppeteer.executablePath();
};

const createBrowser = async () => puppeteer.launch({
  headless: 'new',
  executablePath: getChromeExecutablePath(),
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080'
  ]
});

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

  const browser = await sharedBrowserPromise;
  sharedBrowserPromise = null;
  await browser.close();
};
