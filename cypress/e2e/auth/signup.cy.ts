/// <reference types="cypress" />

describe('Cadastro - Criação de Conta', () => {
  beforeEach(() => {
    cy.visit('/cadastro')
  })

  it('deve exibir o formulário de cadastro (step 1)', () => {
    cy.get('input#fullName').should('be.visible')
    cy.get('input#email').should('be.visible')
    cy.get('input#password').should('be.visible')
    cy.get('input#confirmPassword').should('be.visible')
    cy.get('button[type="button"]').contains(/próximo|proximo/i).should('be.visible')
  })

  it('não deve permitir avançar com email inválido', () => {
    cy.get('input#fullName').type('Test User')
    cy.get('input#email').type('email-invalido')
    cy.get('input#password').type('Senha123')
    cy.get('input#confirmPassword').type('Senha123')
    cy.get('button[type="button"]').contains(/próximo|proximo/i).click()
    // Should stay on step 1 with validation error
    cy.get('input#fullName').should('be.visible')
  })

  it('deve ter link para voltar ao login', () => {
    cy.get('a[href*="/login"]').should('be.visible')
  })
})
