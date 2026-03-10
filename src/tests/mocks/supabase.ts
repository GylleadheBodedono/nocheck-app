/**
 * Mock factory for Supabase client.
 * Returns a chainable query builder that resolves to controlled responses.
 */

type MockResponse = {
  data: unknown
  error: unknown
}

type TableOverrides = Record<string, MockResponse>

function createChainableQuery(response: MockResponse) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    upsert: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    lt: () => chain,
    lte: () => chain,
    gt: () => chain,
    gte: () => chain,
    not: () => chain,
    is: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve(response),
    maybeSingle: () => Promise.resolve(response),
    then: (resolve: (val: MockResponse) => void) => Promise.resolve(response).then(resolve),
  }
  return chain
}

export function createMockSupabase(overrides: TableOverrides = {}) {
  const defaultResponse: MockResponse = { data: null, error: null }

  const from = (table: string) => {
    const response = overrides[table] || defaultResponse
    return createChainableQuery(response)
  }

  return {
    from,
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  }
}
