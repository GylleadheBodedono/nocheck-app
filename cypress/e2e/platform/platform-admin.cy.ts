/// <reference types="cypress" />

describe('Platform - Superadmin', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Dashboard da plataforma (/platform)', () => {
    it('deve carregar a página da plataforma', () => {
      cy.visit('/platform')
      cy.url({ timeout: 15000 }).should('not.include', '/login')
      cy.get('body').should('be.visible')
    })
  })

  describe('Clientes (/platform/clientes)', () => {
    it('deve carregar a lista de clientes', () => {
      cy.visit('/platform/clientes')
      cy.url({ timeout: 15000 }).should('not.include', '/login')
      cy.get('body').should('be.visible')
    })
  })

  describe('Configurações da plataforma (/platform/configuracoes)', () => {
    it('deve carregar configurações', () => {
      cy.visit('/platform/configuracoes')
      cy.url({ timeout: 15000 }).should('not.include', '/login')
      cy.get('body').should('be.visible')
    })
  })

  describe('Pricing (/platform/pricing)', () => {
    it('deve exibir planos e preços', () => {
      cy.visit('/platform/pricing')
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.contains(/starter|professional|enterprise/i).should('exist')
    })

    it('deve exibir valores em R$', () => {
      cy.visit('/platform/pricing')
      cy.contains(/R\$|BRL/i, { timeout: 15000 }).should('exist')
    })
  })
})
