/// <reference types="cypress" />

describe('Admin - Relatórios', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Hub de relatórios (/admin/relatorios)', () => {
    it('deve carregar a página de relatórios', () => {
      cy.visit('/admin/relatorios')
      cy.url({ timeout: 15000 }).should('include', '/admin/relatorios')
      cy.get('body').should('be.visible')
    })

    it('deve exibir links para relatórios disponíveis', () => {
      cy.visit('/admin/relatorios')
      cy.get('a[href]', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })
  })

  describe('Relatório de fotos NC (/admin/relatorios/fotos-nc)', () => {
    it('deve carregar a página', () => {
      cy.visit('/admin/relatorios/fotos-nc')
      cy.url({ timeout: 15000 }).should('include', '/admin/relatorios/fotos-nc')
      cy.get('body').should('be.visible')
    })

    it('deve exibir filtros', () => {
      cy.visit('/admin/relatorios/fotos-nc')
      cy.get('input[type="date"], select', { timeout: 15000 }).should('exist')
    })

    it('deve ter botão de exportar', () => {
      cy.visit('/admin/relatorios/fotos-nc')
      cy.contains(/exportar|download|baixar/i, { timeout: 15000 }).should('exist')
    })
  })

  describe('Relatório de planos de ação (/admin/relatorios/planos-de-acao)', () => {
    it('deve carregar a página', () => {
      cy.visit('/admin/relatorios/planos-de-acao')
      cy.url({ timeout: 15000 }).should('include', '/admin/relatorios/planos-de-acao')
      cy.get('body').should('be.visible')
    })

    it('deve ter botão de exportar', () => {
      cy.visit('/admin/relatorios/planos-de-acao')
      cy.contains(/exportar|download|baixar/i, { timeout: 15000 }).should('exist')
    })
  })
})
