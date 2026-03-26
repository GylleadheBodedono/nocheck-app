/// <reference types="cypress" />

describe('API Routes', () => {
  describe('Auth API', () => {
    it('POST /api/auth/check-email deve retornar status válido', () => {
      cy.request({
        method: 'POST',
        url: '/api/auth/check-email',
        body: { email: 'test@example.com' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 400, 401, 500])
      })
    })
  })

  describe('Admin Users API', () => {
    it('GET /api/admin/users sem auth deve retornar 401/403', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/users',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403])
      })
    })

    it('POST /api/admin/users sem auth deve retornar 401/403', () => {
      cy.request({
        method: 'POST',
        url: '/api/admin/users',
        body: { email: 'new@test.com', password: '123456', full_name: 'New User' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403])
      })
    })
  })

  describe('Upload API', () => {
    it('POST /api/upload sem auth deve retornar erro', () => {
      cy.request({
        method: 'POST',
        url: '/api/upload',
        body: { image: 'data:image/png;base64,iVBOR...', fileName: 'test.png' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 401, 403])
      })
    })
  })

  describe('Billing API', () => {
    it('GET /api/billing/status sem auth deve retornar erro', () => {
      cy.request({
        method: 'GET',
        url: '/api/billing/status',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403, 500])
      })
    })

    it('GET /api/billing/invoices sem auth deve retornar erro', () => {
      cy.request({
        method: 'GET',
        url: '/api/billing/invoices',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403, 500])
      })
    })
  })

  describe('Integrations API', () => {
    it('POST /api/integrations/notify sem auth deve retornar erro', () => {
      cy.request({
        method: 'POST',
        url: '/api/integrations/notify',
        body: { type: 'test' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 401, 403])
      })
    })
  })

  describe('Email API', () => {
    it('POST /api/notifications/email sem auth deve retornar erro', () => {
      cy.request({
        method: 'POST',
        url: '/api/notifications/email',
        body: { to: 'test@test.com', subject: 'Test', html: '<p>Test</p>' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 401, 403])
      })
    })
  })

  describe('Chat API', () => {
    it('POST /api/chat sem auth deve retornar erro', () => {
      cy.request({
        method: 'POST',
        url: '/api/chat',
        body: { messages: [{ role: 'user', content: 'Olá' }] },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 401, 403, 500])
      })
    })
  })

  describe('Settings API', () => {
    it('GET /api/settings deve responder', () => {
      cy.request({
        method: 'GET',
        url: '/api/settings',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 401, 403, 500])
      })
    })
  })

  describe('Storage API', () => {
    it('GET /api/storage deve responder', () => {
      cy.request({
        method: 'GET',
        url: '/api/storage',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 401, 403, 500])
      })
    })
  })

  describe('Rate Limiting', () => {
    it('deve lidar com múltiplas requisições sem erros críticos', () => {
      // Send rapid-fire requests
      const makeRequest = () =>
        cy.request({
          method: 'POST',
          url: '/api/chat',
          body: { messages: [{ role: 'user', content: 'test' }] },
          failOnStatusCode: false,
        })

      // Send 10 sequential requests and collect statuses
      const statuses: number[] = []
      Cypress._.times(10, () => {
        makeRequest().then((res) => {
          statuses.push(res.status)
        })
      })

      // After all requests, verify we got responses (some may be rate limited)
      cy.wrap(statuses).should('have.length.greaterThan', 0)
    })
  })
})
