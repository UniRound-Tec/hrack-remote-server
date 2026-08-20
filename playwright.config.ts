import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/browser',
  timeout: 30_000,
  use: {
    headless: true
  },
  reporter: [['list']]
})

