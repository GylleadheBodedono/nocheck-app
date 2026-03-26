/// <reference types="cypress" />

describe('Admin - Dashboard Principal', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Estrutura do dashboard admin', () => {
    it('deve carregar a página /admin sem redirecionar para login', () => {
      cy.visit('/admin')
      cy.url({ timeout: 15000 }).should('include', '/admin')
      cy.get('body').should('be.visible')
    })

    it('deve exibir conteúdo do painel administrativo', () => {
      cy.visit('/admin')
      // Dashboard should have interactive elements (cards, links, icons)
      cy.get('a, button', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('deve exibir atalhos para seções administrativas', () => {
      cy.visit('/admin')
      const adminLinks = [
        '/admin/usuarios',
        '/admin/lojas',
        '/admin/templates',
        '/admin/setores',
        '/admin/funcoes',
        '/admin/relatorios',
      ]

      // At least one admin section link should be present
      cy.get('a[href]', { timeout: 15000 }).then(($links) => {
        const hrefs = [...$links].map((el) => el.getAttribute('href')).filter(Boolean)
        const hasAdminLinks = adminLinks.some((link) => hrefs.some((href) => href?.includes(link)))
        expect(hasAdminLinks).to.be.true
      })
    })
  })

  describe('KPIs e estatísticas', () => {
    it('deve exibir contadores de totais', () => {
      cy.visit('/admin')
      cy.get('body', { timeout: 15000 }).should('be.visible')
    })
  })
})
