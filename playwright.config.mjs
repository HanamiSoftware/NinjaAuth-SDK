import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/*.spec.mjs",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["junit", { outputFile: "test-results/e2e-junit.xml" }]] : "list",
    outputDir: "test-results",
    use: {
        browserName: "chromium",
        headless: true,
        ignoreHTTPSErrors: true,
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    }
});
