/**
 * Cypress E2E configuration for NoCheck (OpereCheck).
 *
 * Run modes:
 *   npm run cy:open          — interactive (Cypress App)
 *   npm run cy:run           — headless Firefox
 *   npm run cy:run:chrome    — headless Chrome
 *
 * Credentials and Supabase URL can be overridden without touching this file:
 *   • cypress.env.json (git-ignored)
 *   • CLI flags: --env ADMIN_EMAIL=foo,ADMIN_PASSWORD=bar
 *
 * Support file: cypress/support/e2e.ts
 * Custom commands: cypress/support/commands.ts
 */

import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // Dev server must be running on :3000 before launching Cypress
    baseUrl: 'http://localhost:3000',

    // Viewport matches a typical laptop display
    viewportWidth: 1280,
    viewportHeight: 720,

    // Timeouts — generous to account for SSR cold-starts in CI
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,

    // Reduce CI artefact size: no video, screenshots only on failure
    video: false,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',

    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',

    // Allows "Run All Specs" button in the Cypress App
    experimentalRunAllSpecs: true,

    // Retry flaky tests automatically in CI; no retries when developing
    retries: {
      runMode: 2,
      openMode: 0,
    },

    env: {
      // Test user credentials — override via cypress.env.json or CLI flags
      ADMIN_EMAIL: 'admin@operecheck.com.br',
      ADMIN_PASSWORD: '123456',
      USER_EMAIL: 'admin@operecheck.com.br',
      USER_PASSWORD: '123456',
      PLATFORM_ADMIN_EMAIL: 'admin@operecheck.com.br',
      PLATFORM_ADMIN_PASSWORD: '123456',
      // Local Supabase instance started with `supabase start`
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_ANON_KEY: '',
    },

    setupNodeEvents(on, config) {
      // `cy.task('log', message)` — surfaces Node-side console.log in tests
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
      })
      return config
    },
  },
})
