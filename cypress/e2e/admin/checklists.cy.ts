/// <reference types="cypress" />

describe('Admin - Listagem de Checklists', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Listagem', () => {
    it('deve carregar a página de checklists', () => {
      cy.visit('/admin/checklists')
      cy.url({ timeout: 15000 }).should('include', '/admin/checklists')
      cy.get('body').should('be.visible')
    })

    it('deve ter filtros por loja e template', () => {
      cy.visit('/admin/checklists')
      cy.get('select, input[type="text"], input[type="search"], input[type="date"]', { timeout: 15000 }).should('exist')
    })
  })
})
