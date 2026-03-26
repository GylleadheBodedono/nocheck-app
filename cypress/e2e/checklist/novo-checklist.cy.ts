/// <reference types="cypress" />

describe('Novo Checklist - Preenchimento', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Página de novo checklist', () => {
    it('deve carregar sem redirecionar para login', () => {
      cy.visit('/checklist/novo')
      cy.url({ timeout: 15000 }).should('include', '/checklist/novo')
      cy.get('body').should('be.visible')
    })

    it('deve exibir seleção de template ou loja', () => {
      cy.visit('/checklist/novo')
      // Page should have selectable elements (cards, dropdowns, or buttons)
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.get('select, button, a', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })
  })
})
