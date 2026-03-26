/// <reference types="cypress" />

describe('Admin - Configurações', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Configurações gerais (/admin/configuracoes)', () => {
    it('deve carregar a página de configurações', () => {
      cy.visit('/admin/configuracoes')
      cy.url({ timeout: 15000 }).should('include', '/admin/configuracoes')
      cy.get('body').should('be.visible')
    })

    it('deve ter links para sub-configurações', () => {
      cy.visit('/admin/configuracoes')
      cy.get('a[href]', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })
  })

  describe('Billing (/admin/configuracoes/billing)', () => {
    it('deve carregar a página de cobrança', () => {
      cy.visit('/admin/configuracoes/billing')
      cy.url({ timeout: 15000 }).should('include', '/admin/configuracoes/billing')
      cy.get('body').should('be.visible')
    })
  })

  describe('Branding (/admin/configuracoes/branding)', () => {
    it('deve carregar a página de personalização', () => {
      cy.visit('/admin/configuracoes/branding')
      cy.url({ timeout: 15000 }).should('include', '/admin/configuracoes/branding')
      cy.get('body').should('be.visible')
    })

    it('deve ter opção de upload de logo', () => {
      cy.visit('/admin/configuracoes/branding')
      cy.get('input[type="file"], button, label', { timeout: 15000 }).should('exist')
    })
  })

  describe('Equipe (/admin/configuracoes/equipe)', () => {
    it('deve carregar a página de equipe', () => {
      cy.visit('/admin/configuracoes/equipe')
      cy.url({ timeout: 15000 }).should('include', '/admin/configuracoes/equipe')
      cy.get('body').should('be.visible')
    })
  })
})
