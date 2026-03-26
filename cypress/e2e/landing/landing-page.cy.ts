/// <reference types="cypress" />

describe('Landing Page', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Conteúdo principal', () => {
    it('deve exibir o nome do produto', () => {
      cy.contains('OpereCheck').should('be.visible')
    })

    it('deve exibir descrição do produto', () => {
      cy.contains(/gestão|checklist|operacional/i).should('exist')
    })

    it('deve ter call-to-action visível', () => {
      cy.get('a, button').filter(':visible')
        .contains(/começar|criar conta|entrar|login|experimentar/i)
        .should('exist')
    })
  })

  describe('Navegação', () => {
    it('deve ter link para login', () => {
      cy.get('a[href*="/login"]').should('exist')
    })

    it('deve ter link para cadastro', () => {
      cy.get('a[href*="/cadastro"]').should('exist')
    })
  })

  describe('Responsividade', () => {
    it('deve funcionar em viewport mobile', () => {
      cy.viewport('iphone-x')
      cy.visit('/')
      cy.contains('OpereCheck').should('be.visible')
    })

    it('deve funcionar em viewport tablet', () => {
      cy.viewport('ipad-2')
      cy.visit('/')
      cy.contains('OpereCheck').should('be.visible')
    })

    it('deve funcionar em viewport desktop', () => {
      cy.viewport(1920, 1080)
      cy.visit('/')
      cy.contains('OpereCheck').should('be.visible')
    })
  })

  describe('SEO e meta tags', () => {
    it('deve ter título da página', () => {
      cy.title().should('not.be.empty')
    })
  })

  describe('Performance', () => {
    it('deve carregar em tempo razoável', () => {
      // Use performance API for accurate measurement
      cy.visit('/')
      cy.get('body').should('be.visible')
      cy.window().then((win) => {
        const timing = win.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (timing) {
          const loadTime = timing.loadEventEnd - timing.startTime
          expect(loadTime).to.be.lessThan(10000) // 10 seconds max
        }
      })
    })
  })
})
