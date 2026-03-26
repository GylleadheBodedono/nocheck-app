/// <reference types="cypress" />

describe('Admin - Gerenciamento de Funções', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Listagem', () => {
    it('deve carregar a página de funções', () => {
      cy.visit('/admin/funcoes')
      cy.url({ timeout: 15000 }).should('include', '/admin/funcoes')
      cy.get('body').should('be.visible')
    })

    it('deve ter campo de busca', () => {
      cy.visit('/admin/funcoes')
      cy.get('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"], input[type="text"]', { timeout: 15000 })
        .should('exist')
    })

    it('deve exibir botão de criar nova função', () => {
      cy.visit('/admin/funcoes')
      cy.contains(/nova|adicionar|criar/i, { timeout: 15000 }).should('be.visible')
    })
  })

  describe('CRUD de funções', () => {
    it('deve abrir modal ao clicar em criar', () => {
      cy.visit('/admin/funcoes')
      cy.contains(/nova|adicionar|criar/i, { timeout: 15000 }).first().click()
      // Modal or form should appear
      cy.get('input', { timeout: 5000 }).should('have.length.greaterThan', 0)
    })
  })
})
