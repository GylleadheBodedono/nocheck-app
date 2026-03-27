/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />

/**
 * Custom Cypress commands for the NoCheck (OpereCheck) test suite.
 *
 * Commands are grouped by concern:
 *  - Authentication  : login, loginAsAdmin, loginAsPlatformAdmin, logout
 *  - API intercepts  : interceptSupabase, interceptSupabaseTable, interceptAPI
 *  - Network sim     : goOffline, goOnline
 *  - UI helpers      : waitForPageLoad, expectToast, fillField, selectOption,
 *                      assertPath, getByTestId, checkA11y
 *
 * Environment variables expected (set in cypress.config.ts or cypress.env.json):
 *  ADMIN_EMAIL, ADMIN_PASSWORD, USER_EMAIL, USER_PASSWORD,
 *  PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD, SUPABASE_URL
 */

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

      // LoginForm is wrapped in <Suspense> because it uses useSearchParams().
      // The page initially renders a spinner fallback (.animate-spin). Once JS
      // resolves the suspension, the real form mounts.
      //
      // Waiting for the submit button to be visible, NOT disabled, and contain
      // "Entrar" is the most reliable hydration gate because it requires:
      //   1. Suspense to have resolved (form is in the DOM)
      //   2. React to have finished mounting and wired up all synthetic event handlers
      //   3. Component state to be in its initial idle state (loading === false)
      //
      // Without this gate, cy.type() fires keyboard events on a controlled <input>
      // before React's onChange is attached. The DOM shows text but React state
      // stays empty — the form then submits with blank credentials.
      cy.get('button[type="submit"]', { timeout: 15000 })
        .should('be.visible')
        .and('not.be.disabled')
        .and('contain', 'Entrar')

      // Use separate cy.get() calls for each field so every command has its own
      // implicit retry. Chaining .clear().type() off .should('be.visible') on the
      // same subject risks a stale DOM reference if React re-renders between commands.
      //
      // The trailing .should('have.value') verifies that React's controlled-input
      // state was actually updated by onChange. If the field is ever reset (e.g.
      // a late re-render) Cypress surfaces the failure here, not at form submission.
      cy.get('input#email').clear().type(userEmail).should('have.value', userEmail)
      cy.get('input#password').clear().type(userPassword).should('have.value', userPassword)

      cy.get('button[type="submit"]').click()

      // The login handler uses window.location.href (hard browser redirect to
      // /platform or /dashboard depending on user role).
      // Wait until the URL has fully left /login.
      cy.url().should('not.include', '/login', { timeout: 30000 })

      // After the hard redirect the destination page (Next.js SSR) goes through:
      //   1. Server-side render → HTML delivered
      //   2. React hydration   → event handlers attached
      //   3. Auth cookies      → written by @supabase/ssr middleware
      //
      // Hydration mismatches ("Hydration failed", "Unknown root exit status")
      // are suppressed in e2e.ts — they are environment noise, not app failures.
      //
      // Wait for the page body to be visible, then wait for any loading spinners
      // to clear. This gives React time to finish its render cycle and for
      // @supabase/ssr to flush the auth cookie Set-Cookie headers before
      // cy.session snapshots the browser state.
      cy.get('body').should('be.visible')
      cy.get('.animate-spin', { timeout: 10000 }).should('not.exist')

      // Verify the Supabase SSR auth cookie exists before cy.session snapshots
      // browser state. Cookie name pattern: sb-<project-ref>-auth-token.
      // Without this, cy.session can save a pre-auth snapshot and every protected
      // route visit will redirect back to /login.
      cy.getCookies().should((cookies) => {
        const hasAuth = cookies.some((c) => c.name.includes('auth-token'))
        expect(hasAuth, 'Supabase auth cookie must be present after login').to.be.true
      })
    },
    {
      cacheAcrossSpecs: true,
      validate() {
        // Validate that the restored session still has the Supabase auth cookie.
        // Using .should() (not nested .then()) so Cypress can properly retry the
        // assertion and correctly fail/invalidate the session when the cookie is gone.
        // If this assertion fails, cy.session re-runs the setup function above.
        cy.getCookies().should((cookies) => {
          const hasAuth = cookies.some((c) => c.name.includes('auth-token'))
          expect(hasAuth, 'Supabase auth cookie missing — session will be re-created').to.be.true
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
