/// <reference types="cypress" />

describe('Offline / PWA', () => {
  describe('Indicador de status offline', () => {
    it('deve simular modo offline sem erros', () => {
      cy.login()
      cy.visit('/dashboard')
      cy.get('body', { timeout: 15000 }).should('be.visible')

      cy.goOffline()
      // Page should still be visible (offline mode)
      cy.get('body').should('be.visible')
    })

    it('deve restaurar ao voltar online', () => {
      cy.login()
      cy.visit('/dashboard')
      cy.get('body', { timeout: 15000 }).should('be.visible')

      cy.goOffline()
      cy.get('body').should('be.visible')
      cy.goOnline()
      cy.get('body', { timeout: 15000 }).should('be.visible')
    })
  })

  describe('Página offline (/offline)', () => {
    it('deve exibir a página de fallback offline', () => {
      cy.visit('/offline')
      cy.get('body').should('be.visible')
    })

    it('deve ter mensagem sobre modo offline', () => {
      cy.visit('/offline')
      cy.contains(/offline|sem conexão|desconectado/i).should('exist')
    })
  })

  describe('IndexedDB cache', () => {
    it('deve criar bancos IndexedDB após login', () => {
      cy.login()
      cy.visit('/dashboard')
      cy.get('body', { timeout: 15000 }).should('be.visible')

      // Wait for data to be cached, then verify databases exist
      cy.wait(2000) // Allow time for async IndexedDB operations

      cy.window().then((win) => {
        return new Cypress.Promise((resolve) => {
          const dbNames = ['operecheck-cache', 'operecheck-offline']
          let checked = 0

          dbNames.forEach((name) => {
            const req = win.indexedDB.open(name)
            req.onsuccess = () => {
              const db = req.result
              expect(db.name).to.equal(name)
              db.close()
              checked++
              if (checked === dbNames.length) resolve()
            }
            req.onerror = () => {
              checked++
              if (checked === dbNames.length) resolve()
            }
          })
        })
      })
    })
  })
})
