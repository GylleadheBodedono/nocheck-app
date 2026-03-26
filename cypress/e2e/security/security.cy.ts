/// <reference types="cypress" />

describe('Segurança', () => {
  describe('Proteção contra XSS', () => {
    it('deve sanitizar inputs na URL', () => {
      cy.visit('/login?error=%3Cscript%3Ealert(1)%3C/script%3E')
      // The page should render without executing the script
      // Verify the raw script tag is not rendered as HTML
      cy.get('body').then(($body) => {
        const html = $body.html()
        expect(html).not.to.include('<script>alert(1)</script>')
      })
    })

    it('deve escapar HTML em mensagens de erro', () => {
      cy.visit('/login?error=%3Cb%3Ebold%3C/b%3E')
      // The <b> tag should be escaped/sanitized, not rendered as bold
      cy.get('body').then(($body) => {
        const html = $body.html()
        // Should not contain unescaped HTML tag
        expect(html).not.to.match(/<b>bold<\/b>/)
      })
    })
  })

  describe('Proteção de rotas', () => {
    it('API de admin requer autenticação', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/users',
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.be.oneOf([401, 403])
      })
    })

    it('API de upload requer autenticação', () => {
      cy.request({
        method: 'POST',
        url: '/api/upload',
        body: {},
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 401, 403])
      })
    })

    it('API de email requer autenticação', () => {
      cy.request({
        method: 'POST',
        url: '/api/notifications/email',
        body: {},
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 401, 403])
      })
    })
  })

  describe('Cabeçalhos de segurança', () => {
    it('deve ter cabeçalhos de segurança na resposta', () => {
      cy.request('/').then((res) => {
        // At least one security header should be present
        const hasSecurityHeaders =
          res.headers['x-content-type-options'] ||
          res.headers['x-frame-options'] ||
          res.headers['content-security-policy'] ||
          res.headers['strict-transport-security']
        expect(hasSecurityHeaders).to.be.ok
      })
    })
  })

  describe('Proteção contra Open Redirect', () => {
    it('não deve redirecionar para URLs externas', () => {
      cy.visit('/login?redirect=https://evil.com', { failOnStatusCode: false })
      cy.url().should('not.include', 'evil.com')
    })
  })

  describe('Enumeração de emails', () => {
    it('recuperação de senha não deve revelar se email existe', () => {
      cy.visit('/esqueci-senha')
      cy.get('input#email, input[type="email"]').type('nonexistent@test.com')
      cy.get('button[type="submit"]').click()

      // Should show a generic message (not "email not found")
      // The page transitions to OTP step or shows a generic success message
      cy.contains(/enviamos|receberá|enviado|verifique/i, { timeout: 10000 }).should('exist')
    })
  })
})
