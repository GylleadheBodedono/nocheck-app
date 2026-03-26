/// <reference types="cypress" />

describe('Admin - Logs de Auditoria', () => {
  beforeEach(() => {
    cy.login()
  })

  it('deve carregar a página de logs', () => {
    cy.visit('/admin/logs')
    cy.url({ timeout: 15000 }).should('include', '/admin/logs')
    cy.get('body').should('be.visible')
  })

  it('deve ter filtros', () => {
    cy.visit('/admin/logs')
    cy.get('select, input[type="text"], input[type="search"], input[type="date"]', { timeout: 15000 }).should('exist')
  })
})
