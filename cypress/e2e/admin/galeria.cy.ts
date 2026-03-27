/// <reference types="cypress" />

describe('Admin - Galeria de Fotos', () => {
  beforeEach(() => {
    cy.login()
  })

  it('deve carregar a página de galeria', () => {
    cy.visit('/admin/galeria')
    cy.url({ timeout: 15000 }).should('include', '/admin/galeria')
    cy.get('body').should('be.visible')
  })

  it('deve ter filtros de busca', () => {
    cy.visit('/admin/galeria')
    cy.get('select, input[type="text"], input[type="search"], input[type="date"]', { timeout: 15000 }).should('exist')
  })
})
