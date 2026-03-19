/* eslint-disable */
// eslint-disable @typescript-eslint/no-unused-vars, react/display-name
// ============================================
// Testes — TenantGuard
// ============================================
// Valida que o componente de protecao de rotas
// bloqueia/libera acesso corretamente baseado em:
//   - Role minimo
//   - Permissao especifica
//   - Feature flag
//   - Platform admin
// ============================================

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { TenantCtx } from '@/hooks/useTenant'
import { TenantGuard } from '@/components/tenant/TenantGuard'
import type { TenantContext } from '@/types/tenant'

// Helper: cria wrapper com TenantContext
function Wrapper({ ctx, children }: { ctx: Partial<TenantContext>; children: React.ReactNode }) {
  const defaultCtx: TenantContext = {
    organization: null,
    currentRole: null,
    features: [],
    isPlatformAdmin: false,
    isOwner: false,
    isOrgAdmin: false,
    isManager: false,
    orgSlug: null,
    isLoading: false,
    ...ctx,
  }

  return createElement(TenantCtx.Provider, { value: defaultCtx }, children)
}

describe('TenantGuard', () => {
  // --- requiredRole ---

  describe('requiredRole', () => {
    it('admin pode acessar pagina que requer admin', () => {
      render(
        <Wrapper ctx={{ currentRole: 'admin' }}>
          <TenantGuard requiredRole="admin">
            <div data-testid="conteudo">Painel Admin</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.getByTestId('conteudo')).toBeInTheDocument()
    })

    it('member NAO pode acessar pagina que requer admin', () => {
      render(
        <Wrapper ctx={{ currentRole: 'member' }}>
          <TenantGuard requiredRole="admin">
            <div data-testid="conteudo">Painel Admin</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.queryByTestId('conteudo')).not.toBeInTheDocument()
      expect(screen.getByText('Acesso Negado')).toBeInTheDocument()
    })

    it('owner pode acessar qualquer pagina', () => {
      render(
        <Wrapper ctx={{ currentRole: 'owner' }}>
          <TenantGuard requiredRole="admin">
            <div data-testid="conteudo">OK</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.getByTestId('conteudo')).toBeInTheDocument()
    })
  })

  // --- platformAdminOnly ---

  describe('platformAdminOnly', () => {
    it('superadmin pode acessar', () => {
      render(
        <Wrapper ctx={{ isPlatformAdmin: true }}>
          <TenantGuard platformAdminOnly>
            <div data-testid="platform">Dashboard Plataforma</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.getByTestId('platform')).toBeInTheDocument()
    })

    it('admin normal NAO pode acessar pagina de superadmin', () => {
      render(
        <Wrapper ctx={{ currentRole: 'owner', isPlatformAdmin: false }}>
          <TenantGuard platformAdminOnly>
            <div data-testid="platform">Dashboard Plataforma</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.queryByTestId('platform')).not.toBeInTheDocument()
      expect(screen.getByText('Acesso Negado')).toBeInTheDocument()
      expect(screen.getByText(/administradores da plataforma/)).toBeInTheDocument()
    })
  })

  // --- requiredFeature ---

  describe('requiredFeature', () => {
    it('mostra conteudo se feature esta no plano', () => {
      render(
        <Wrapper ctx={{ features: ['export_excel', 'basic_orders'], currentRole: 'member' }}>
          <TenantGuard requiredFeature="export_excel">
            <div data-testid="export">Exportar</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.getByTestId('export')).toBeInTheDocument()
    })

    it('bloqueia se feature NAO esta no plano', () => {
      render(
        <Wrapper ctx={{ features: ['basic_orders'], currentRole: 'member' }}>
          <TenantGuard requiredFeature="export_excel">
            <div data-testid="export">Exportar</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.queryByTestId('export')).not.toBeInTheDocument()
      expect(screen.getByText(/não está disponível no seu plano/)).toBeInTheDocument()
    })

    it('superadmin bypassa feature check', () => {
      render(
        <Wrapper ctx={{ isPlatformAdmin: true, features: [] }}>
          <TenantGuard requiredFeature="white_label">
            <div data-testid="wl">White Label</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.getByTestId('wl')).toBeInTheDocument()
    })
  })

  // --- requiredPermission ---

  describe('requiredPermission', () => {
    it('owner pode manage_billing', () => {
      render(
        <Wrapper ctx={{ currentRole: 'owner' }}>
          <TenantGuard requiredPermission="manage_billing">
            <div data-testid="billing">Billing</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.getByTestId('billing')).toBeInTheDocument()
    })

    it('admin NAO pode manage_billing', () => {
      render(
        <Wrapper ctx={{ currentRole: 'admin' }}>
          <TenantGuard requiredPermission="manage_billing">
            <div data-testid="billing">Billing</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.queryByTestId('billing')).not.toBeInTheDocument()
    })
  })

  // --- Loading state ---

  describe('loading', () => {
    it('nao renderiza nada enquanto carrega', () => {
      render(
        <Wrapper ctx={{ isLoading: true }}>
          <TenantGuard requiredRole="admin">
            <div data-testid="conteudo">Admin</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.queryByTestId('conteudo')).not.toBeInTheDocument()
      expect(screen.queryByText('Acesso Negado')).not.toBeInTheDocument()
    })
  })

  // --- Fallback customizado ---

  describe('fallback', () => {
    it('renderiza fallback customizado em vez de AccessDenied padrao', () => {
      render(
        <Wrapper ctx={{ currentRole: 'viewer' }}>
          <TenantGuard requiredRole="admin" fallback={<div data-testid="custom-403">Upgrade seu plano</div>}>
            <div data-testid="conteudo">Admin</div>
          </TenantGuard>
        </Wrapper>
      )

      expect(screen.queryByTestId('conteudo')).not.toBeInTheDocument()
      expect(screen.getByTestId('custom-403')).toBeInTheDocument()
    })
  })
})
