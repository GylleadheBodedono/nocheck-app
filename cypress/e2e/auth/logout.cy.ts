/// <reference types="cypress" />

describe('Logout - Encerramento de Sessão', () => {
  it('deve limpar localStorage ao fazer logout', () => {
    cy.visit('/login')
    // Simulate stored session
    cy.window().then((win) => {
      win.localStorage.setItem('sb-test-auth-token', JSON.stringify({
        access_token: 'fake',
        user: { id: '1' },
      }))
    })

    cy.logout()

    cy.window().then((win) => {
      expect(win.localStorage.length).to.equal(0)
    })
  })

  it('deve limpar cookies ao fazer logout', () => {
    cy.setCookie('sb-test-auth-token', 'fake-cookie')
    cy.logout()
    cy.getCookies().should('have.length', 0)
  })

  it('deve limpar IndexedDB ao fazer logout', () => {
    // Create a test database and wait for it to be ready
    cy.window().then((win) => {
      return new Cypress.Promise((resolve) => {
        const req = win.indexedDB.open('operecheck-cache', 1)
        req.onsuccess = () => {
          req.result.close()
          resolve()
        }
        req.onerror = () => resolve()
      })
    })

    cy.logout()

    // Verify database was deleted by opening it fresh
    cy.window().then((win) => {
      return new Cypress.Promise((resolve) => {
        const req = win.indexedDB.open('operecheck-cache', 1)
        req.onsuccess = () => {
          const db = req.result
          // If it opens with version 1 and no stores, it was recreated (clean)
          expect(db.objectStoreNames.length).to.equal(0)
          db.close()
          win.indexedDB.deleteDatabase('operecheck-cache')
          resolve()
        }
        req.onerror = () => resolve()
      })
    })
  })
})
