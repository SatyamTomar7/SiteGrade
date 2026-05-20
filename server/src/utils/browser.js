import puppeteer from 'puppeteer';

export const getChromeExecutablePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return puppeteer.executablePath();
};
