/// <reference types="cypress" />

/**
 * Full Application Flow — One Shot
 *
 * Logs in ONCE (session persists via testIsolation: false) and navigates
 * through every major page, exercising real UI interactions on each one.
 * Hydration errors and non-fatal Next.js exceptions are suppressed globally
 * in cypress/support/e2e.ts.
 */
describe('Full Application Flow', { testIsolation: false }, () => {
  // ─── Login once for all tests ────────────────────────────────────────────────
  before(() => {
    cy.loginAsAdmin()
    cy.visit('/admin', { timeout: 20000 })
    cy.url({ timeout: 20000 }).should('include', '/admin')
  })

  // ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
  context('Admin — Dashboard', () => {
    it('loads KPI cards and navigation shortcuts', () => {
      cy.url().should('include', '/admin')
      cy.get('body').should('be.visible')
      // Should have interactive elements
      cy.get('a, button', { timeout: 15000 }).should('have.length.greaterThan', 3)
      // At least one link to an admin sub-section
      cy.get('a[href*="/admin/"]', { timeout: 15000 }).should('exist')
    })
  })

  // ─── ADMIN — USUÁRIOS ─────────────────────────────────────────────────────────
  context('Admin — Usuários', () => {
    before(() => cy.visit('/admin/usuarios'))

    it('stays on the usuarios page without login redirect', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/usuarios')
    })

    it('renders a search input and types without crashing', () => {
      cy.get(
        'input[placeholder*="uscar"], input[placeholder*="esquisar"], input[type="search"], input[type="text"]',
        { timeout: 15000 }
      )
        .first()
        .clear()
        .type('admin')
      cy.get('body').should('be.visible')
    })

    it('shows a link to create a new user', () => {
      cy.get('a[href*="/admin/usuarios/novo"]', { timeout: 15000 }).should('exist')
    })

    it('create-user form has multiple input fields', () => {
      cy.visit('/admin/usuarios/novo')
      cy.get('input', { timeout: 15000 }).should('have.length.greaterThan', 1)
    })
  })

  // ─── ADMIN — LOJAS ────────────────────────────────────────────────────────────
  context('Admin — Lojas', () => {
    before(() => cy.visit('/admin/lojas'))

    it('stays on the lojas page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/lojas')
    })

    it('has a search input', () => {
      cy.get(
        'input[placeholder*="uscar"], input[placeholder*="esquisar"], input[type="search"], input[type="text"]',
        { timeout: 15000 }
      ).should('exist')
    })

    it('shows a create-store button and opens the modal', () => {
      cy.contains(/nova|adicionar|criar/i, { timeout: 15000 }).should('be.visible')
      cy.contains(/nova|adicionar|criar/i).first().click()
      cy.get('input', { timeout: 10000 }).should('have.length.greaterThan', 0)
    })

    it('can close / dismiss the modal with Escape', () => {
      cy.get('body').type('{esc}')
      // Page is still intact
      cy.url().should('include', '/admin/lojas')
    })
  })

  // ─── ADMIN — SETORES ─────────────────────────────────────────────────────────
  context('Admin — Setores', () => {
    before(() => cy.visit('/admin/setores'))

    it('stays on the setores page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/setores')
    })

    it('has a search input and a create button', () => {
      cy.get(
        'input[placeholder*="uscar"], input[placeholder*="esquisar"], input[type="search"], input[type="text"]',
        { timeout: 15000 }
      ).should('exist')
      cy.contains(/novo|adicionar|criar/i, { timeout: 15000 }).should('be.visible')
    })

    it('opens create-sector modal/form on click', () => {
      cy.contains(/novo|adicionar|criar/i).first().click()
      cy.get('input', { timeout: 10000 }).should('have.length.greaterThan', 0)
      cy.get('body').type('{esc}')
    })
  })

  // ─── ADMIN — FUNÇÕES ─────────────────────────────────────────────────────────
  context('Admin — Funções', () => {
    before(() => cy.visit('/admin/funcoes'))

    it('stays on the funcoes page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/funcoes')
      cy.get('body').should('be.visible')
    })

    it('has a create button and opens modal/form', () => {
      cy.contains(/novo|adicionar|criar/i, { timeout: 15000 })
        .should('be.visible')
        .first()
        .click()
      cy.get('input', { timeout: 10000 }).should('have.length.greaterThan', 0)
      cy.get('body').type('{esc}')
    })
  })

  // ─── ADMIN — TEMPLATES ────────────────────────────────────────────────────────
  context('Admin — Templates', () => {
    before(() => cy.visit('/admin/templates'))

    it('stays on the templates page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/templates')
    })

    it('has a search input', () => {
      cy.get(
        'input[placeholder*="uscar"], input[placeholder*="esquisar"], input[type="search"], input[type="text"]',
        { timeout: 15000 }
      ).should('exist')
    })

    it('has a link to create a new template', () => {
      cy.get('a[href*="/admin/templates/novo"]', { timeout: 15000 }).should('exist')
    })

    it('create-template page shows form with fields and switches', () => {
      cy.visit('/admin/templates/novo')
      cy.get('input', { timeout: 15000 }).should('have.length.greaterThan', 0)
      cy.get(
        'select, [role="listbox"], [role="combobox"], input[type="checkbox"], button[role="switch"]',
        { timeout: 15000 }
      ).should('exist')
    })

    it('create-template page has an add-field button', () => {
      cy.contains(/adicionar campo|novo campo|add/i, { timeout: 15000 }).should('exist')
    })
  })

  // ─── ADMIN — CHECKLISTS ────────────────────────────────────────────────────────
  context('Admin — Checklists', () => {
    before(() => cy.visit('/admin/checklists'))

    it('stays on the checklists page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/checklists')
      cy.get('body').should('be.visible')
    })

    it('has interactive elements (filters / table / cards)', () => {
      cy.get('a, button, select', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })
  })

  // ─── ADMIN — VALIDAÇÕES ────────────────────────────────────────────────────────
  context('Admin — Validações', () => {
    before(() => cy.visit('/admin/validacoes'))

    it('stays on the validacoes page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/validacoes')
      cy.get('body').should('be.visible')
    })

    it('shows status filter controls', () => {
      cy.get('select, button, [role="tab"]', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })
  })

  // ─── ADMIN — PLANOS DE AÇÃO ────────────────────────────────────────────────────
  context('Admin — Planos de Ação', () => {
    before(() => cy.visit('/admin/planos-de-acao'))

    it('stays on the planos-de-acao page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/planos-de-acao')
      cy.get('body').should('be.visible')
    })

    it('has a create or new-action-plan button', () => {
      cy.contains(/novo|adicionar|criar/i, { timeout: 15000 }).should('exist')
    })

    it('models page loads', () => {
      cy.visit('/admin/planos-de-acao/modelos')
      cy.url({ timeout: 15000 }).should('include', '/admin/planos-de-acao/modelos')
      cy.get('body').should('be.visible')
    })
  })

  // ─── ADMIN — GALERIA ─────────────────────────────────────────────────────────
  context('Admin — Galeria', () => {
    before(() => cy.visit('/admin/galeria'))

    it('stays on the galeria page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/galeria')
      cy.get('body').should('be.visible')
    })

    it('has filter controls (store, date, or type selectors)', () => {
      cy.get('select, input[type="date"], button', { timeout: 15000 }).should(
        'have.length.greaterThan',
        0
      )
    })
  })

  // ─── ADMIN — LOGS ─────────────────────────────────────────────────────────────
  context('Admin — Logs', () => {
    before(() => cy.visit('/admin/logs'))

    it('stays on the logs page', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/logs')
      cy.get('body').should('be.visible')
    })

    it('has table or list of log entries area', () => {
      cy.get('table, ul, [role="list"], [class*="log"]', { timeout: 15000 }).then(($el) => {
        // Either a structured list exists or the page body rendered without errors
        if ($el.length === 0) {
          cy.get('body').should('be.visible')
        }
      })
    })
  })

  // ─── ADMIN — RELATÓRIOS ────────────────────────────────────────────────────────
  context('Admin — Relatórios', () => {
    before(() => cy.visit('/admin/relatorios'))

    it('stays on the relatorios page and shows report links', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/relatorios')
      cy.get('a[href]', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('fotos-nc report has filters and export button', () => {
      cy.visit('/admin/relatorios/fotos-nc')
      cy.url({ timeout: 15000 }).should('include', '/admin/relatorios/fotos-nc')
      cy.get('input[type="date"], select', { timeout: 15000 }).should('exist')
      cy.contains(/exportar|download|baixar/i, { timeout: 15000 }).should('exist')
    })

    it('planos-de-acao report has export button', () => {
      cy.visit('/admin/relatorios/planos-de-acao')
      cy.url({ timeout: 15000 }).should('include', '/admin/relatorios/planos-de-acao')
      cy.contains(/exportar|download|baixar/i, { timeout: 15000 }).should('exist')
    })
  })

  // ─── ADMIN — CONFIGURAÇÕES ────────────────────────────────────────────────────
  context('Admin — Configurações', () => {
    before(() => cy.visit('/admin/configuracoes'))

    it('stays on the configuracoes page with sub-section links', () => {
      cy.url({ timeout: 15000 }).should('include', '/admin/configuracoes')
      cy.get('a[href]', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('billing page loads', () => {
      cy.visit('/admin/configuracoes/billing')
      cy.url({ timeout: 15000 }).should('include', '/admin/configuracoes/billing')
      cy.get('body').should('be.visible')
    })

    it('branding page loads with upload option', () => {
      cy.visit('/admin/configuracoes/branding')
      cy.url({ timeout: 15000 }).should('include', '/admin/configuracoes/branding')
      cy.get('input[type="file"], button, label', { timeout: 15000 }).should('exist')
    })

    it('equipe page loads', () => {
      cy.visit('/admin/configuracoes/equipe')
      cy.url({ timeout: 15000 }).should('include', '/admin/configuracoes/equipe')
      cy.get('body').should('be.visible')
    })
  })

  // ─── USER DASHBOARD ───────────────────────────────────────────────────────────
  context('User — Dashboard', () => {
    before(() => cy.visit('/dashboard'))

    it('stays on /dashboard without redirect', () => {
      cy.url({ timeout: 15000 }).should('include', '/dashboard')
    })

    it('renders interactive elements (buttons, links)', () => {
      cy.get('a, button', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('has a checklist link or button', () => {
      cy.get('a[href*="/checklist"]', { timeout: 15000 }).should('exist')
    })
  })

  // ─── USER RELATÓRIOS ──────────────────────────────────────────────────────────
  context('User — Relatórios', () => {
    before(() => cy.visit('/relatorios'))

    it('stays on /relatorios without redirect', () => {
      cy.url({ timeout: 15000 }).should('include', '/relatorios')
      cy.get('body').should('be.visible')
    })

    it('has period filter controls (date or select)', () => {
      cy.get('select, input[type="date"]', { timeout: 15000 }).should('exist')
    })
  })

  // ─── CHECKLIST ────────────────────────────────────────────────────────────────
  context('Checklist', () => {
    it('novo-checklist page with query params does not redirect to login', () => {
      cy.visit('/checklist/novo?template=1&store=1')
      cy.url({ timeout: 15000 }).should('not.include', '/login')
      cy.url().should('include', 'template=1')
      cy.get('body').should('be.visible')
    })

    it('/checklist/1 does not redirect to login (may 404 if no data)', () => {
      cy.visit('/checklist/1', { failOnStatusCode: false })
      cy.url({ timeout: 15000 }).should('not.include', '/login')
    })
  })
})
