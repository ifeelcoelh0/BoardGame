import { defineConfig } from "cypress";

export default defineConfig({
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultCommandTimeout: 15_000,
  pageLoadTimeout: 30_000,
  video: false,
  screenshotOnRunFailure: true,
  retries: {
    runMode: 1,
    openMode: 0,
  },
  e2e: {
    baseUrl: "http://127.0.0.1:4173",
    supportFile: false,
    specPattern: "cypress/e2e/**/*.cy.js",
  },
});
