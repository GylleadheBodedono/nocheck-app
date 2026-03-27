/// <reference types="cypress" />

describe('Admin - Validações Cruzadas', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Listagem de validações', () => {
    it('deve carregar a página de validações', () => {
      cy.visit('/admin/validacoes')
      cy.url({ timeout: 15000 }).should('include', '/admin/validacoes')
      cy.get('body').should('be.visible')
    })

    it('deve ter filtros', () => {
      cy.visit('/admin/validacoes')
      cy.get('select, button, input', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })
  })
})
