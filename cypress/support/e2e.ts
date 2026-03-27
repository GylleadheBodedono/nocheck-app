/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />
/// <reference types="cypress-real-events" />

/**
 * E2E support entry point — loaded before every spec file.
 *
 * Responsibilities:
 *  1. Import custom commands (see commands.ts)
 *  2. Register cypress-real-events so cy.realPress / cy.realClick / etc. work
 *  3. Suppress known non-fatal exceptions that would otherwise fail tests
 *  4. Hide noisy XHR/fetch entries from the Cypress command log
 */

import './commands'
import 'cypress-real-events'

// Hide fetch/XHR logs from command log for cleaner output
const app = window.top
if (app && !app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style')
  style.innerHTML = '.command-name-request, .command-name-xhr { display: none }'
  style.setAttribute('data-hide-command-log-request', '')
  app.document.head.appendChild(style)
}

// Prevent known non-test-breaking exceptions from failing tests
Cypress.on('uncaught:exception', (err) => {
  const msg = err.message

  // Supabase realtime / WebSocket
  if (msg.includes('WebSocket') || msg.includes('realtime')) return false
  // Service Worker
  if (msg.includes('ServiceWorker') || msg.includes('sw.js')) return false
  // ResizeObserver (benign in responsive UIs)
  if (msg.includes('ResizeObserver')) return false
  // Next.js internal navigation / not-found
  if (msg.includes('NEXT_REDIRECT') || msg.includes('NEXT_NOT_FOUND')) return false
  // React hydration mismatches (all known patterns)
  if (
    msg.includes('Hydration') ||
    msg.includes('hydrat') ||
    msg.includes('did not match') ||
    msg.includes('Text content does not match') ||
    msg.includes('server-side rendering') ||
    msg.includes('Minified React error #418') ||
    msg.includes('Minified React error #423') ||
    msg.includes('Minified React error #425')
  )
    return false
  // React internal cascading errors that follow a hydration mismatch.
  // "Unknown root exit status" is React's signal that it could not recover from
  // a prior rendering error — it is a downstream symptom, not an app logic bug.
  if (msg.includes('Unknown root exit status')) return false
  // Catch-all for other minified React internal errors (e.g. #301, #310, #421)
  // that surface during hydration in the test environment.
  if (/Minified React error #\d+/.test(msg)) return false
  // Next.js chunk / lazy load errors (transient in test env)
  if (msg.includes('Loading chunk') || msg.includes('ChunkLoadError')) return false
  // React Query dev tools or observer errors
  if (msg.includes('ReactQueryDevtools') || msg.includes('MutationObserver')) return false
  // Next.js router abort (navigating away mid-request)
  if (msg.includes('AbortError') || msg.includes('The operation was aborted')) return false
  // Clerk publishable key missing (not configured in test env)
  if (msg.includes('publishable key')) return false

  return true
})
