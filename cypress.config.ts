import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    experimentalRunAllSpecs: true,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    env: {
      // Test user credentials (override via cypress.env.json or CLI)
      ADMIN_EMAIL: 'admin@operecheck.com.br',
      ADMIN_PASSWORD: '123456',
      USER_EMAIL: 'admin@operecheck.com.br',
      USER_PASSWORD: '123456',
      PLATFORM_ADMIN_EMAIL: 'admin@operecheck.com.br',
      PLATFORM_ADMIN_PASSWORD: '123456',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_ANON_KEY: '',
    },
    setupNodeEvents(on, config) {
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
