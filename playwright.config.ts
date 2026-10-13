import { defineConfig, devices } from "@playwright/test";

const PORT = 3931;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: {
      // Software WebGL, so the check also runs on CI machines without a GPU.
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@docs/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grepInvert: /@docs/ },
    // `npm run screenshots`: regenerates the images in docs/ from the fake hand replay.
    { name: "docs", use: { ...devices["Desktop Chrome"] }, grep: /@docs/ },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
