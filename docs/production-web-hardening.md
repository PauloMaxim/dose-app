# Production web hardening audit

## Baseline and decisions

The app is a TanStack Start/Vite application with file-based route splitting, SSR, authenticated
Supabase server functions, and a small Zustand-persisted UI/demo cache. Server-only integrations are
under `src/server` or `*.server.ts`; no service-role, billing-provider, ingestion, webhook, or AI
provider module is imported by the root client graph. Supabase remains authoritative for identity,
content, notification preferences, and entitlements. Local storage is appropriate only for visual,
onboarding, reminder-UI, and legacy migration state; hydration explicitly restores the plan as free.

The existing Grok preview plugin remains because it owns preview/install tooling and has a tested
contract. Production document metadata no longer points to its virtual manifest or nonexistent PNG
icon: it uses the checked-in Dose manifest and icon. Removing the plugin itself is deferred because
that is preview-infrastructure work, not a production performance fix.

## Performance and assets

Routes are already split by TanStack Router. No additional component fragmentation was introduced:
the shared components are small and artificial lazy boundaries would add waterfalls. Covers are
reusable local editorial assets with fixed aspect-ratio containers. Images below the fold now decode
asynchronously and lazy-load; the lead edition is eager/high priority. A stable local fallback avoids
broken images. Existing JPEGs are unusually large (many 700–960 KB); converting them requires visual
QA and responsive derivatives and is intentionally deferred rather than silently changing artwork.
Google Fonts remain a render/network dependency and should eventually be self-hosted/subsetted.

## PWA and cache policy

The versioned service worker is registered after `load` in production and caches only the manifest,
icon, and same-origin public cover assets. Navigations, API/server-function responses, cross-origin
requests, authenticated data, entitlements, payments, tokens, and arbitrary responses are never
intercepted. Activation deletes old cache versions. There is intentionally no offline HTML fallback:
SSR pages can be user-specific and serving a cached document risks private or stale content.

## Notifications

No sender, VAPID secret, or background push handler exists. Browser permission remains behind the
explicit reminder action in onboarding/settings. The prior foreground timer notification is no longer
mounted, so this hardening does not emit notifications. Server contracts validate strict HTTPS
subscriptions, derive `user_id` exclusively from the authenticated session, upsert by the existing
`(user_id, endpoint)` uniqueness constraint, and support owned deletion. Preferences use the existing
table and server authority. Future delivery needs a separately reviewed worker, server-only VAPID
configuration, consent UX, expiry cleanup, timezone semantics, and operational observability.

## Internationalization and remaining work

The existing lightweight `pt`/`en` catalog is retained; `pt` maps explicitly to `pt-BR`. Native
`Intl` helpers centralize display-only date and number formatting while timestamps stay ISO/UTC in
data. UI locale remains separate from source scientific language and future summary language. Missing
keys are prevented by the typed catalog and Portuguese is the deterministic fallback. Spanish and
other catalogs can be added later without changing scientific content.

No migration, deployment, remote Supabase operation, ingestion, AI call, billing call, generated
image, push send, credential, mascot art, or visual redesign is part of this change.
