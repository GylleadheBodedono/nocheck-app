/// <reference types="cypress" />

describe('Navegação e Roteamento', () => {
  describe('Rotas públicas (sem autenticação)', () => {
    beforeEach(() => {
      cy.logout()
    })

    it('deve exibir a landing page em /', () => {
      cy.visit('/')
      cy.contains('OpereCheck').should('be.visible')
    })

    it('deve exibir a página de login', () => {
      cy.visit('/login')
      cy.get('input#email').should('be.visible')
    })

    it('deve exibir a página de cadastro', () => {
      cy.visit('/cadastro')
      cy.url().should('include', '/cadastro')
      cy.get('body').should('be.visible')
    })

    it('deve exibir a página de esqueci-senha', () => {
      cy.visit('/esqueci-senha')
      cy.url().should('include', '/esqueci-senha')
      cy.get('body').should('be.visible')
    })

    it('deve exibir a página offline', () => {
      cy.visit('/offline')
      cy.url().should('include', '/offline')
      cy.get('body').should('be.visible')
    })
  })

  describe('Rotas protegidas (redirecionamento sem auth)', () => {
    beforeEach(() => {
      cy.logout()
    })

    const protectedRoutes = [
      '/dashboard',
      '/admin',
      '/checklist/novo',
      '/relatorios',
      '/platform',
      '/admin/usuarios',
    ]

    protectedRoutes.forEach((route) => {
      it(`deve redirecionar ${route} para /login sem sessão`, () => {
        cy.visit(route, { failOnStatusCode: false })
        cy.url({ timeout: 15000 }).should('include', '/login')
      })
    })
  })

  describe('Middleware - Auth redirect', () => {
    it('deve redirecionar auth errors para /login com mensagem', () => {
      cy.visit('/?error=access_denied&error_description=Link%20expirado', { failOnStatusCode: false })
      cy.url({ timeout: 15000 }).should('include', '/login')
    })

    it('deve redirecionar token_hash para /auth/confirm', () => {
      cy.visit('/?token_hash=test123&type=signup', { failOnStatusCode: false })
      cy.url({ timeout: 15000 }).should('include', '/auth/confirm')
    })

    it('deve redirecionar code para /auth/callback', () => {
      cy.visit('/?code=test-auth-code', { failOnStatusCode: false })
      cy.url({ timeout: 15000 }).should('include', '/auth/callback')
    })
  })
})
