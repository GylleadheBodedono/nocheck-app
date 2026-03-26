/// <reference types="cypress" />

describe('Recuperação de Senha', () => {
  describe('Página esqueci-senha', () => {
    beforeEach(() => {
      cy.visit('/esqueci-senha')
    })

    it('deve exibir o formulário de recuperação', () => {
      cy.contains(/recuperar|esqueci|redefinir/i).should('be.visible')
      cy.get('input#email, input[type="email"]').should('be.visible')
      cy.get('button[type="submit"]').should('be.visible')
    })

    it('deve avançar para step de OTP ao enviar email', () => {
      cy.get('input#email, input[type="email"]').type('admin@operecheck.com.br')
      cy.get('button[type="submit"]').click()

      // Should transition to OTP step — look for OTP inputs or confirmation text
      cy.contains(/enviamos|código|verificação/i, { timeout: 15000 }).should('be.visible')
    })

    it('deve ter link para voltar ao login', () => {
      cy.get('a[href*="/login"]').should('be.visible')
    })
  })

  describe('Página reset-password', () => {
    it('deve exibir formulário de nova senha', () => {
      cy.visit('/auth/reset-password')
      cy.get('input#password, input[type="password"]').should('exist')
    })
  })
})
