/// <reference types="cypress" />

describe('Admin - Gerenciamento de Setores', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Listagem', () => {
    it('deve carregar a página de setores', () => {
      cy.visit('/admin/setores')
      cy.url({ timeout: 15000 }).should('include', '/admin/setores')
      cy.get('body').should('be.visible')
    })

    it('deve ter campo de busca', () => {
      cy.visit('/admin/setores')
      cy.get('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"], input[type="text"]', { timeout: 15000 })
        .should('exist')
    })

    it('deve ter botão de criar novo setor', () => {
      cy.visit('/admin/setores')
      cy.contains(/novo|adicionar|criar/i, { timeout: 15000 }).should('be.visible')
    })
  })

  describe('CRUD de setores', () => {
    it('deve abrir modal ao clicar em criar', () => {
      cy.visit('/admin/setores')
      cy.contains(/novo|adicionar|criar/i, { timeout: 15000 }).first().click()
      // Modal or form should appear
      cy.get('input', { timeout: 5000 }).should('have.length.greaterThan', 0)
    })
  })
})
