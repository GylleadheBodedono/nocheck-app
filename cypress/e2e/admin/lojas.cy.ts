/// <reference types="cypress" />

describe('Admin - Gerenciamento de Lojas', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Listagem de lojas', () => {
    it('deve carregar a página de lojas', () => {
      cy.visit('/admin/lojas')
      cy.url({ timeout: 15000 }).should('include', '/admin/lojas')
      cy.get('body').should('be.visible')
    })

    it('deve ter campo de busca', () => {
      cy.visit('/admin/lojas')
      cy.get('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"], input[type="text"]', { timeout: 15000 })
        .should('exist')
    })

    it('deve exibir botão de criar nova loja', () => {
      cy.visit('/admin/lojas')
      cy.contains(/nova|adicionar|criar/i, { timeout: 15000 }).should('be.visible')
    })
  })

  describe('Modal de criação/edição de loja', () => {
    it('deve abrir modal ao clicar em nova loja', () => {
      cy.visit('/admin/lojas')
      cy.contains(/nova|adicionar|criar/i, { timeout: 15000 }).first().click()
      // Modal or form should appear with input fields
      cy.get('input', { timeout: 5000 }).should('have.length.greaterThan', 0)
    })
  })
})
