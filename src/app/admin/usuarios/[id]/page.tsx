'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { FiSave, FiPlus, FiX, FiUserCheck } from 'react-icons/fi'
import type { Store, UserRole, User, UserStoreRole } from '@/types/database'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header } from '@/components/ui'

type UserWithRoles = User & {
  roles: (UserStoreRole & { store: Store })[]
}

type RoleAssignment = {
  id?: number
  store_id: number
  store_name: string
  role: UserRole
}

export default function EditarUsuarioPage() {
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<UserWithRoles | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [roles, setRoles] = useState<RoleAssignment[]>([])

  // Temp state for adding roles
  const [selectedStore, setSelectedStore] = useState<number>(0)
  const [selectedRole, setSelectedRole] = useState<UserRole>('estoquista')

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const fetchData = async () => {
    if (!userId) return

    // Fetch user with roles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData, error: userError } = await (supabase as any)
      .from('users')
      .select(`
        *,
        roles:user_store_roles!user_store_roles_user_id_fkey(
          *,
          store:stores(*)
        )
      `)
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('Error fetching user:', userError)
      router.push(APP_CONFIG.routes.adminUsers)
      return
    }

    const typedUser = userData as UserWithRoles
    setUser(typedUser)
    setFullName(typedUser.full_name)
    setEmail(typedUser.email)
    setPhone(typedUser.phone || '')
    setIsAdmin(typedUser.is_admin)
    setIsActive(typedUser.is_active)
    setRoles(
      typedUser.roles.map(r => ({
        id: r.id,
        store_id: r.store_id,
        store_name: r.store.name,
        role: r.role,
      }))
    )

    // Fetch stores
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storesData } = await (supabase as any)
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (storesData) {
      setStores(storesData as Store[])
      if (storesData.length > 0) {
        setSelectedStore((storesData as Store[])[0].id)
      }
    }

    setLoading(false)
  }

  const addRole = () => {
    if (!selectedStore) return

    // Check if already has this role for this store
    if (roles.some(r => r.store_id === selectedStore && r.role === selectedRole)) {
      setError('Este cargo já foi atribuído para esta loja')
      return
    }

    const store = stores.find(s => s.id === selectedStore)
    if (!store) return

    setRoles([
      ...roles,
      {
        store_id: selectedStore,
        store_name: store.name,
        role: selectedRole,
      },
    ])
    setError(null)
  }

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      // 1. Update user profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase as any)
        .from('users')
        .update({
          full_name: fullName,
          phone: phone || null,
          is_admin: isAdmin,
          is_active: isActive,
        })
        .eq('id', userId)

      if (profileError) throw profileError

      // 2. Delete existing roles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('user_store_roles')
        .delete()
        .eq('user_id', userId)

      if (deleteError) throw deleteError

      // 3. Insert new roles
      if (roles.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rolesError } = await (supabase as any)
          .from('user_store_roles')
          .insert(
            roles.map(r => ({
              user_id: userId,
              store_id: r.store_id,
              role: r.role,
            }))
          )

        if (rolesError) throw rolesError
      }

      setSuccess('Usuario atualizado com sucesso!')

      // Refresh data
      fetchData()

    } catch (err) {
      console.error('Error updating user:', err)
      setError(err instanceof Error ? err.message : 'Erro ao atualizar usuario')
    }

    setSaving(false)
  }

  const roleOptions: UserRole[] = ['estoquista', 'aprendiz', 'supervisor', 'gerente']

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      estoquista: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
      aprendiz: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
      supervisor: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
      gerente: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    }
    return colors[role] || 'bg-surface-hover text-muted'
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      estoquista: 'Estoquista',
      aprendiz: 'Aprendiz',
      supervisor: 'Supervisor',
      gerente: 'Gerente',
    }
    return labels[role] || role
  }

  if (loading) {
    return <LoadingPage />
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-page">
      <Header
        variant="page"
        title="Editar Usuario"
        icon={FiUserCheck}
        backHref={APP_CONFIG.routes.adminUsers}
        maxWidth="3xl"
      />

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success Message */}
          {success && (
            <div className="p-4 bg-success rounded-xl border border-success">
              <p className="text-success text-sm">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-error rounded-xl border border-error">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-main mb-4">Informacoes Basicas</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="input"
                  placeholder="Nome completo do usuario"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="input opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-muted mt-1">O email nao pode ser alterado</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-default bg-surface text-primary"
                  />
                  <span className="text-sm text-secondary">Usuario ativo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                    className="w-5 h-5 rounded border-default bg-surface text-primary"
                  />
                  <span className="text-sm text-secondary">Administrador</span>
                </label>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-main mb-4">Cargos e Lojas</h2>
            <p className="text-sm text-muted mb-4">
              Atribua os cargos do usuario para cada loja que ele tera acesso.
            </p>

            {/* Add Role */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(Number(e.target.value))}
                className="input flex-1"
              >
                <option value={0} disabled>Selecione a loja</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="input flex-1"
              >
                {roleOptions.map(role => (
                  <option key={role} value={role}>
                    {getRoleLabel(role)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={addRole}
                className="btn-secondary flex items-center gap-2 px-4 py-2"
              >
                <FiPlus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            {/* Roles List */}
            {roles.length === 0 ? (
              <div className="text-center py-8 text-muted border border-dashed border-subtle rounded-xl">
                <p>Nenhum cargo atribuido</p>
                <p className="text-sm mt-1">Adicione pelo menos um cargo para o usuario ter acesso aos checklists</p>
              </div>
            ) : (
              <div className="space-y-2">
                {roles.map((role, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-surface-hover rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-main">{role.store_name}</span>
                      <span className={`badge-secondary ${getRoleBadgeColor(role.role)}`}>
                        {getRoleLabel(role.role)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRole(index)}
                      className="p-2 text-error hover:bg-error/20 rounded-lg transition-colors"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href={APP_CONFIG.routes.adminUsers}
              className="btn-secondary flex-1 py-3 text-center"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
            >
              {saving ? (
                'Salvando...'
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  Salvar Alteracoes
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
