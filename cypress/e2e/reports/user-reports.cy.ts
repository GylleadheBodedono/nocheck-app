/// <reference types="cypress" />

describe('Relatórios do Usuário', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Página de relatórios (/relatorios)', () => {
    it('deve carregar a página de relatórios', () => {
      cy.visit('/relatorios')
      cy.url({ timeout: 15000 }).should('include', '/relatorios')
      cy.get('body').should('be.visible')
    })

    it('deve ter filtros por período', () => {
      cy.visit('/relatorios')
      cy.get('select, input[type="date"]', { timeout: 15000 }).should('exist')
    })
  })
})
