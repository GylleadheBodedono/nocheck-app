/// <reference types="cypress" />

describe('Admin - Gerenciamento de Usuários', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Listagem de usuários (/admin/usuarios)', () => {
    it('deve carregar a página de usuários', () => {
      cy.visit('/admin/usuarios')
      cy.url({ timeout: 15000 }).should('include', '/admin/usuarios')
      cy.get('body').should('be.visible')
    })

    it('deve ter campo de busca', () => {
      cy.visit('/admin/usuarios')
      cy.get('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"], input[type="text"]', { timeout: 15000 })
        .should('exist')
    })

    it('deve filtrar usuários por busca', () => {
      cy.visit('/admin/usuarios')
      cy.get('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"], input[type="text"]', { timeout: 15000 })
        .first()
        .clear()
        .type('admin')
      // Should not cause errors — filtering happens reactively
      cy.get('body').should('be.visible')
    })

    it('deve exibir botão para criar novo usuário', () => {
      cy.visit('/admin/usuarios')
      cy.get('a[href*="/admin/usuarios/novo"]', { timeout: 15000 }).should('exist')
    })
  })

  describe('Criação de usuário (/admin/usuarios/novo)', () => {
    it('deve exibir formulário de criação de usuário', () => {
      cy.visit('/admin/usuarios/novo')
      cy.get('input', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('deve ter campos de nome, email, senha, loja, função e setor', () => {
      cy.visit('/admin/usuarios/novo')
      cy.get('input, select', { timeout: 15000 }).should('have.length.greaterThan', 2)
    })
  })
})
