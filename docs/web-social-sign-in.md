# Web social sign-in setup

The webapp exchanges Google and Apple identity tokens through its same-origin
`/bff/auth/social` route. That route validates the request origin, passes the
provider proof to the Go identity service, and writes the resulting session to
the webapp's HTTP-only cookies. Provider tokens stay in memory in the browser.

## Provider configuration

- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the Google web OAuth client ID. Add
  every deployed webapp origin to the authorized JavaScript origins in Google
  Cloud. The GIS button is rendered by Google's official browser SDK.
- Set `NEXT_PUBLIC_APPLE_CLIENT_ID` to the Apple Services ID. Register the
  production domain and the webapp origin as the return URL in the Apple
  developer configuration. Apple sign-in requires HTTPS on deployed origins.
- Do not put provider client secrets in `NEXT_PUBLIC_*` variables. The current
  browser flow does not need a client secret; token signature/audience checks
  remain server-side.
- Keep both IDs unset in environments where provider OAuth is not configured.
  Mock mode can use the local demo identity; real mode must show the
  not-configured error instead of accepting a fabricated identity.

## First-time registration and birthday

The browser creates a cryptographically random nonce for each provider flow.
Apple additionally receives its SHA-256 form as required by its identity-token
contract. If the backend responds with `BIRTHDAY_REQUIRED`, the UI holds the
provider token and original nonce in component memory, validates the date and
resubmits the same proof with the birthday. The backend remains authoritative
for the minimum age and account creation. The same-origin BFF rejects malformed
or impossible Gregorian dates rather than silently dropping them. Reloading
abandons the transient challenge; users can start sign-in again.

The in-page sign-in prompt uses Nantty's theme-aware wordmark in the dialog's
plain icon slot, suppresses the generic sign-in glyph, and removes the circular
intent badge. The web-kit dialog contract test verifies the plain presentation
and confirms the intent icon is not rendered.

When `WEBAPP_USE_MOCKS=true`, the Google and Apple auth mock routes also return
`BIRTHDAY_REQUIRED` until a birthday is included. This keeps the first-time
registration challenge reachable in local/manual UI testing; it does not
replace the Go identity service's authoritative validation. Mock contract tests
cover the challenge and successful retry for both providers.

## Verification checklist

- Confirm the provider console client IDs, authorized origin/domain and Apple
  return URL match the deployed webapp origin.
- Test returning sign-in and first-time registration for Google and Apple.
- For first-time registration, verify a valid birthday succeeds, a child age is
  rejected server-side, and a malformed/tampered token, nonce or Apple state is
  rejected.
- Verify the HTTP-only session cookies are set only after the Go identity
  service accepts the provider token, and no provider token is persisted in
  local or session storage.
- Test in dark and light Nantty themes; the Google provider button follows the
  resolved theme while Nantty's brand palette and wordmark remain unchanged.

Source tests cover request payloads, birthday-proof reuse, CSP origins and the
social button contract. Live provider-console configuration and actual Google
or Apple browser authorization still require a configured preview/production
origin and have not been verified from this local workspace.

## Local integration follow-up — 2026-11-12

The same-origin BFF now selects Google's `idToken` or Apple's `identityToken`
according to the chosen provider and forwards the Apple first-registration
birthday/full-name fields using the Go contract. A local route integration test
captures the actual HTTP request received by a test gateway for both providers;
rejects an impossible calendar date and forwards a valid leap-day date. The
browser now also preserves a validated `next` destination after social
sign-in. Challenge proof remains memory-only by design (reload requires a new
provider attempt), and the full browser-provider round trip still needs a
configured E2E environment. The route and browser service tests pass locally.
This does not replace the provider-console and live authorization checks above.
