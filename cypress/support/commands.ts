/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />

import '@testing-library/cypress/add-commands'

// ─── Types ───────────────────────────────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      /** Login via UI and cache the session */
      login(email?: string, password?: string): Chainable<void>
      /** Login as admin user */
      loginAsAdmin(): Chainable<void>
      /** Login as platform superadmin */
      loginAsPlatformAdmin(): Chainable<void>
      /** Logout and clear all caches */
      logout(): Chainable<void>
      /** Intercept all Supabase REST API calls */
      interceptSupabase(): Chainable<void>
      /** Intercept specific Supabase table queries */
      interceptSupabaseTable(table: string, alias: string, response?: object): Chainable<void>
      /** Intercept internal API routes */
      interceptAPI(method: string, route: string, alias: string, response?: object): Chainable<void>
      /** Simulate offline mode */
      goOffline(): Chainable<void>
      /** Restore online mode */
      goOnline(): Chainable<void>
      /** Wait for page to be fully loaded (no loading spinners) */
      waitForPageLoad(): Chainable<void>
      /** Check that a toast/alert message appears */
      expectToast(message: string): Chainable<void>
      /** Fill a form field by label text */
      fillField(label: string, value: string): Chainable<void>
      /** Select option from custom dropdown by label */
      selectOption(label: string, optionText: string): Chainable<void>
      /** Assert current URL path */
      assertPath(path: string): Chainable<void>
      /** Get element by data-testid attribute */
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>
      /** Assert page has no accessibility violations (basic) */
      checkA11y(): Chainable<void>
    }
  }
}

// ─── Authentication Commands ─────────────────────────────────────────────────

Cypress.Commands.add('login', (email?: string, password?: string) => {
  const userEmail = email || Cypress.env('ADMIN_EMAIL')
  const userPassword = password || Cypress.env('ADMIN_PASSWORD')

  cy.session(
    userEmail,
    () => {
      cy.visit('/login')
      cy.get('input#email').should('be.visible').clear().type(userEmail)
      cy.get('input#password').should('be.visible').clear().type(userPassword)
      cy.get('button[type="submit"]').click()

      // Wait until we leave the login page (redirect to /dashboard or /platform)
      cy.url().should('not.include', '/login', { timeout: 30000 })
    },
    {
      cacheAcrossSpecs: true,
      validate() {
        // Session is valid if we have Supabase auth cookies
        cy.getCookies().then((cookies) => {
          const hasAuth = cookies.some(
            (c) => c.name.includes('auth-token') || c.name.includes('supabase')
          )
          // Also accept localStorage token as valid
          cy.window().then((win) => {
            const hasLocalStorage = Object.keys(win.localStorage).some(
              (k) => k.includes('auth-token') || k.includes('supabase')
            )
            expect(hasAuth || hasLocalStorage).to.be.true
          })
        })
      },
    }
  )
})

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login(Cypress.env('ADMIN_EMAIL'), Cypress.env('ADMIN_PASSWORD'))
})

Cypress.Commands.add('loginAsPlatformAdmin', () => {
  cy.login(Cypress.env('PLATFORM_ADMIN_EMAIL'), Cypress.env('PLATFORM_ADMIN_PASSWORD'))
})

Cypress.Commands.add('logout', () => {
  cy.clearLocalStorage()
  cy.clearCookies()
  cy.window().then((win) => {
    win.sessionStorage.clear()
    const dbs = ['operecheck-cache', 'operecheck-offline']
    dbs.forEach((dbName) => {
      win.indexedDB.deleteDatabase(dbName)
    })
  })
})

// ─── API Intercept Commands ──────────────────────────────────────────────────

Cypress.Commands.add('interceptSupabase', () => {
  const supabaseUrl = Cypress.env('SUPABASE_URL')
  cy.intercept('GET', `${supabaseUrl}/rest/v1/**`).as('supabaseGet')
  cy.intercept('POST', `${supabaseUrl}/rest/v1/**`).as('supabasePost')
  cy.intercept('PATCH', `${supabaseUrl}/rest/v1/**`).as('supabasePatch')
  cy.intercept('DELETE', `${supabaseUrl}/rest/v1/**`).as('supabaseDelete')
  cy.intercept('GET', `${supabaseUrl}/auth/v1/**`).as('supabaseAuth')
})

Cypress.Commands.add('interceptSupabaseTable', (table: string, alias: string, response?: object) => {
  const supabaseUrl = Cypress.env('SUPABASE_URL')
  if (response) {
    cy.intercept('GET', `${supabaseUrl}/rest/v1/${table}*`, {
      statusCode: 200,
      body: response,
    }).as(alias)
  } else {
    cy.intercept('GET', `${supabaseUrl}/rest/v1/${table}*`).as(alias)
  }
})

Cypress.Commands.add('interceptAPI', (method: string, route: string, alias: string, response?: object) => {
  if (response) {
    cy.intercept(method as any, `/api/${route}`, {
      statusCode: 200,
      body: response,
    }).as(alias)
  } else {
    cy.intercept(method as any, `/api/${route}`).as(alias)
  }
})

// ─── Network Simulation Commands ─────────────────────────────────────────────

Cypress.Commands.add('goOffline', () => {
  cy.log('Simulating offline mode')
  cy.window().then((win) => {
    win.dispatchEvent(new Event('offline'))
    cy.stub(win.navigator, 'onLine').value(false)
  })
})

Cypress.Commands.add('goOnline', () => {
  cy.log('Restoring online mode')
  cy.window().then((win) => {
    win.dispatchEvent(new Event('online'))
  })
  cy.reload()
})

// ─── UI Helper Commands ──────────────────────────────────────────────────────

Cypress.Commands.add('waitForPageLoad', () => {
  // Wait for loading spinners to disappear
  cy.get('[data-loading="true"]', { timeout: 15000 }).should('not.exist')
  cy.get('.animate-spin', { timeout: 5000 }).should('not.exist')
})

Cypress.Commands.add('expectToast', (message: string) => {
  cy.contains(message, { timeout: 10000 }).should('be.visible')
})

Cypress.Commands.add('fillField', (label: string, value: string) => {
  cy.contains('label', label)
    .invoke('attr', 'for')
    .then((forAttr) => {
      if (forAttr) {
        cy.get(`#${forAttr}`).clear().type(value)
      } else {
        cy.contains('label', label).parent().find('input, textarea').clear().type(value)
      }
    })
})

Cypress.Commands.add('selectOption', (label: string, optionText: string) => {
  cy.contains('label', label).parent().find('select').select(optionText)
})

Cypress.Commands.add('assertPath', (path: string) => {
  cy.url().should('include', path)
})

Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`)
})

Cypress.Commands.add('checkA11y', () => {
  cy.get('img').each(($img) => {
    cy.wrap($img).should('have.attr', 'alt')
  })
  cy.get('input:visible, select:visible, textarea:visible').each(($input) => {
    const id = $input.attr('id')
    const ariaLabel = $input.attr('aria-label')
    const ariaLabelledBy = $input.attr('aria-labelledby')
    if (!ariaLabel && !ariaLabelledBy && id) {
      cy.get(`label[for="${id}"]`).should('exist')
    }
  })
})

export {}
