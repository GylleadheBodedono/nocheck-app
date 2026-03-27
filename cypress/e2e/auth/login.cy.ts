/// <reference types="cypress" />

describe('Login - Autenticação', () => {
  beforeEach(() => {
    cy.logout()
    cy.visit('/login')
    // Wait for the Suspense boundary to resolve and React to finish mounting
    // before any test tries to interact with form elements.
    cy.get('button[type="submit"]', { timeout: 15000 })
      .should('be.visible')
      .and('not.be.disabled')
      .and('contain', 'Entrar')
  })

  describe('Renderização da página', () => {
    it('deve exibir o formulário de login com todos os elementos', () => {
      cy.contains('OpereCheck').should('be.visible')
      cy.contains('Entre com suas credenciais').should('be.visible')
      cy.get('input#email').should('be.visible').and('have.attr', 'placeholder', 'seu@email.com')
      cy.get('input#password').should('be.visible').and('have.attr', 'placeholder', '••••••••')
      cy.get('button[type="submit"]').should('be.visible').and('contain', 'Entrar')
      cy.contains('Esqueci minha senha').should('be.visible')
      cy.contains('Criar conta').should('be.visible')
    })

    it('deve exibir o label Email e Senha', () => {
      cy.get('label[for="email"]').should('contain', 'Email')
      cy.get('label[for="password"]').should('contain', 'Senha')
    })
  })

  describe('Validação de formulário', () => {
    it('não deve submeter com campos vazios (validação HTML5)', () => {
      cy.get('button[type="submit"]').click()
      cy.get('input#email:invalid').should('exist')
    })

    it('não deve submeter com email inválido', () => {
      cy.get('input#email').type('invalido')
      cy.get('input#password').type('123456')
      cy.get('button[type="submit"]').click()
      cy.get('input#email:invalid').should('exist')
    })

    it('não deve submeter sem senha', () => {
      cy.get('input#email').type('admin@operecheck.com.br')
      cy.get('button[type="submit"]').click()
      cy.get('input#password:invalid').should('exist')
    })
  })

  describe('Toggle de visibilidade da senha', () => {
    it('deve alternar entre mostrar e ocultar senha', () => {
      cy.get('input#password').type('minhasenha')
      cy.get('input#password').should('have.attr', 'type', 'password')

      cy.get('button[aria-label="Mostrar senha"]').click()
      cy.get('input#password').should('have.attr', 'type', 'text')
      cy.get('button[aria-label="Ocultar senha"]').should('exist')

      cy.get('button[aria-label="Ocultar senha"]').click()
      cy.get('input#password').should('have.attr', 'type', 'password')
      cy.get('button[aria-label="Mostrar senha"]').should('exist')
    })
  })

  describe('Login com credenciais inválidas', () => {
    it('deve exibir erro ao usar credenciais erradas', () => {
      cy.get('input#email').type('wrong@email.com')
      cy.get('input#password').type('wrongpass')
      cy.get('button[type="submit"]').click()

      cy.contains(/incorretos|inválid|erro/i, { timeout: 15000 }).should('be.visible')
      cy.url().should('include', '/login')
    })
  })

  describe('Login com sucesso (real)', () => {
    it('deve redirecionar para /dashboard ao logar com credenciais válidas', () => {
      cy.get('input#email').type('admin@operecheck.com.br')
      cy.get('input#password').type('123456')
      cy.get('button[type="submit"]').click()

      cy.contains('Autenticando').should('be.visible')
      cy.url().should('not.include', '/login', { timeout: 30000 })
    })
  })

  describe('Status de loading', () => {
    it('deve desabilitar botão durante o login', () => {
      cy.get('input#email').type('admin@operecheck.com.br')
      cy.get('input#password').type('123456')
      cy.get('button[type="submit"]').click()

      cy.get('button[type="submit"]').should('be.disabled')
      cy.contains('Autenticando').should('be.visible')
    })
  })

  describe('Links de navegação', () => {
    it('deve navegar para esqueci senha', () => {
      cy.contains('Esqueci minha senha').click()
      cy.url().should('include', '/esqueci-senha')
    })

    it('deve navegar para cadastro', () => {
      cy.contains('Criar conta').click()
      cy.url().should('include', '/cadastro')
    })
  })

  describe('Mensagens via searchParams', () => {
    it('deve exibir mensagem de erro via query param', () => {
      cy.visit('/login?error=Link%20expirado')
      cy.contains('Link expirado').should('be.visible')
    })

    it('deve exibir mensagem de sucesso via query param', () => {
      cy.visit('/login?message=Conta%20confirmada%20com%20sucesso')
      cy.contains('Conta confirmada com sucesso').should('be.visible')
    })
  })
})
