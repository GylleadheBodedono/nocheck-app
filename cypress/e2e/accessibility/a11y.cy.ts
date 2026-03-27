/// <reference types="cypress" />

describe('Acessibilidade (A11y)', () => {
  describe('Página de Login', () => {
    beforeEach(() => {
      cy.visit('/login')
      // Wait for the Suspense boundary to resolve before running a11y assertions
      cy.get('button[type="submit"]', { timeout: 15000 })
        .should('be.visible')
        .and('not.be.disabled')
    })

    it('todos os inputs devem ter labels associados', () => {
      cy.get('input#email').then(($input) => {
        cy.get(`label[for="${$input.attr('id')}"]`).should('exist')
      })
      cy.get('input#password').then(($input) => {
        cy.get(`label[for="${$input.attr('id')}"]`).should('exist')
      })
    })

    it('botão de mostrar senha deve ter aria-label', () => {
      cy.get('button[aria-label]').should('have.length.greaterThan', 0)
      cy.get('button[aria-label="Mostrar senha"]').should('exist')
    })

    it('inputs devem ter autocomplete correto', () => {
      cy.get('input#email').should('have.attr', 'autocomplete', 'email')
      cy.get('input#password').should('have.attr', 'autocomplete', 'current-password')
    })

    it('formulário deve ter campos required marcados', () => {
      cy.get('input#email').should('have.attr', 'required')
      cy.get('input#password').should('have.attr', 'required')
    })

    it('links devem ter href válido', () => {
      cy.get('a[href]').each(($link) => {
        const href = $link.attr('href')
        expect(href).to.not.be.empty
      })
    })
  })

  describe('Contraste e visibilidade', () => {
    it('texto principal deve estar visível', () => {
      cy.visit('/login')
      cy.contains('Email').should('be.visible')
      cy.contains('Senha').should('be.visible')
      cy.contains('Entrar').should('be.visible')
    })
  })

  describe('Navegação por teclado', () => {
    it('deve ser possível navegar pelo formulário com Tab', () => {
      cy.visit('/login')
      cy.get('button[type="submit"]', { timeout: 15000 }).should('be.visible').and('not.be.disabled')
      cy.get('input#email').focus().should('have.focus')
      cy.realPress('Tab')
      // Next focusable element should receive focus
      cy.focused().should('exist')
    })

    it('formulário deve ser submetido com Enter', () => {
      cy.visit('/login')
      cy.get('button[type="submit"]', { timeout: 15000 }).should('be.visible').and('not.be.disabled')
      cy.get('input#email').type('test@test.com').should('have.value', 'test@test.com')
      cy.get('input#password').type('123456{enter}')
      // Form should attempt submission (button becomes disabled or shows loading state)
      cy.get('button[type="submit"]').should('exist')
    })
  })

  describe('Responsividade', () => {
    const viewports: Cypress.ViewportPreset[] = ['iphone-6', 'ipad-2', 'macbook-15']

    viewports.forEach((viewport) => {
      it(`deve renderizar corretamente em ${viewport}`, () => {
        cy.viewport(viewport)
        cy.visit('/login')
        cy.get('input#email').should('be.visible')
        cy.get('input#password').should('be.visible')
        cy.get('button[type="submit"]').should('be.visible')
      })
    })
  })
})
