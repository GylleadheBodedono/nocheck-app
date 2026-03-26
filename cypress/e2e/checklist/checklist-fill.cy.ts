/// <reference types="cypress" />

describe('Checklist - Preenchimento por ID', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Acesso a checklist existente', () => {
    it('deve carregar sem redirecionar para login', () => {
      cy.visit('/checklist/1', { failOnStatusCode: false })
      cy.url({ timeout: 15000 }).should('not.include', '/login')
    })
  })

  describe('Página de novo checklist com parâmetros', () => {
    it('deve aceitar parâmetros de template e store na URL', () => {
      cy.visit('/checklist/novo?template=1&store=1')
      cy.url().should('include', 'template=1')
      cy.url().should('include', 'store=1')
      cy.get('body', { timeout: 15000 }).should('be.visible')
    })
  })
})
