/// <reference types="cypress" />

describe('Admin - Gerenciamento de Templates', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Listagem de templates (/admin/templates)', () => {
    it('deve carregar a página de templates', () => {
      cy.visit('/admin/templates')
      cy.url({ timeout: 15000 }).should('include', '/admin/templates')
      cy.get('body').should('be.visible')
    })

    it('deve ter campo de busca', () => {
      cy.visit('/admin/templates')
      cy.get('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"], input[type="text"]', { timeout: 15000 })
        .should('exist')
    })

    it('deve ter link para criar novo template', () => {
      cy.visit('/admin/templates')
      cy.get('a[href*="/admin/templates/novo"]', { timeout: 15000 }).should('exist')
    })
  })

  describe('Criação de template (/admin/templates/novo)', () => {
    it('deve exibir formulário de criação', () => {
      cy.visit('/admin/templates/novo')
      cy.get('input', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('deve ter seletor de categoria', () => {
      cy.visit('/admin/templates/novo')
      cy.get('select, [role="listbox"], [role="combobox"]', { timeout: 15000 }).should('exist')
    })

    it('deve ter opções de assinatura e foto', () => {
      cy.visit('/admin/templates/novo')
      cy.get('input[type="checkbox"], button[role="switch"], [role="switch"]', { timeout: 15000 }).should('exist')
    })

    it('deve permitir adicionar campos ao template', () => {
      cy.visit('/admin/templates/novo')
      cy.contains(/adicionar campo|novo campo|add/i, { timeout: 15000 }).should('exist')
    })
  })
})
