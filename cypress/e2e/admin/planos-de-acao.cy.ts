/// <reference types="cypress" />

describe('Admin - Planos de Ação', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Listagem de planos (/admin/planos-de-acao)', () => {
    it('deve carregar a página de planos de ação', () => {
      cy.visit('/admin/planos-de-acao')
      cy.url({ timeout: 15000 }).should('include', '/admin/planos-de-acao')
      cy.get('body').should('be.visible')
    })

    it('deve ter filtros', () => {
      cy.visit('/admin/planos-de-acao')
      cy.get('select, button, input', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('deve ter link para criar novo plano', () => {
      cy.visit('/admin/planos-de-acao')
      cy.get('a[href*="/admin/planos-de-acao/novo"]', { timeout: 15000 }).should('exist')
    })
  })

  describe('Criação de plano manual (/admin/planos-de-acao/novo)', () => {
    it('deve exibir formulário de criação', () => {
      cy.visit('/admin/planos-de-acao/novo')
      cy.get('input, select, textarea', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })
  })

  describe('Modelos de plano (/admin/planos-de-acao/modelos)', () => {
    it('deve carregar a página de modelos', () => {
      cy.visit('/admin/planos-de-acao/modelos')
      cy.url({ timeout: 15000 }).should('include', '/admin/planos-de-acao/modelos')
      cy.get('body').should('be.visible')
    })
  })
})
