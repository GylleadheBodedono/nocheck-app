/// <reference types="cypress" />

describe('Tema (Dark/Light Mode)', () => {
  describe('Toggle de tema na página de login', () => {
    it('deve exibir o botão de alternar tema', () => {
      cy.visit('/login')
      // ThemeToggle uses aria-label "Ativar modo escuro" or "Ativar modo claro"
      cy.get('button[aria-label*="modo"]', { timeout: 10000 }).should('exist')
    })

    it('deve alternar entre dark e light mode', () => {
      cy.visit('/login')

      // Read initial theme from data-theme attribute
      cy.document().then((doc) => {
        const initialTheme = doc.documentElement.getAttribute('data-theme') || 'light'

        // Click theme toggle
        cy.get('button[aria-label*="modo"]').first().click()

        // Theme attribute should change
        cy.document().its('documentElement')
          .should('have.attr', 'data-theme')
          .and('not.equal', initialTheme)
      })
    })

    it('deve persistir tema no localStorage', () => {
      cy.visit('/login')
      cy.get('button[aria-label*="modo"]').first().click()

      // The app uses 'nocheck-theme' as the storage key (defined in APP_CONFIG)
      cy.window().then((win) => {
        const theme = win.localStorage.getItem('nocheck-theme')
        expect(theme).to.be.oneOf(['dark', 'light'])
      })
    })
  })
})
