/// <reference types="cypress" />

describe('Dashboard do Usuário', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Estrutura da página', () => {
    it('deve carregar o dashboard sem redirecionar para login', () => {
      cy.visit('/dashboard')
      cy.url({ timeout: 15000 }).should('include', '/dashboard')
      cy.get('body').should('be.visible')
    })

    it('deve exibir conteúdo principal do dashboard', () => {
      cy.visit('/dashboard')
      // Dashboard should have some interactive elements
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.get('a, button', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('deve exibir link para novo checklist', () => {
      cy.visit('/dashboard')
      cy.get('a[href*="/checklist"]', { timeout: 15000 }).should('exist')
    })
  })
})
