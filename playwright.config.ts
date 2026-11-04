import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/ui',
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: process.env.DEENPATH_TEST_URL || 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    },
  },
  reporter: 'list',
});
