# Developer, Sandbox, and Messenger UI patterns

Status: implementation guide, 2026-11-13. This standard extends the Nantty design system; it does not create a new brand or imply that disconnected services are live.

## Product boundaries

- `apps/developer` is the authenticated business-integration workspace for app ownership, scopes, credentials, API documentation, webhook management, request logs, usage, billing, and audit history.
- `apps/sandbox` is a separate web application and deployment for test credentials, synthetic tenants, API exploration, deterministic scenarios, webhook events, and request inspection. Sandbox data and credentials must not cross into production.
- `apps/messenger` is the separate React Native client for existing Nantty identity, conversations, and Stories. It shares the existing social identity/message store and encryption model; it must not fork chat history or expose feed, Mart, ads, or creator surfaces.
- These clients share visual primitives and tokens, not sessions, environment trust, or data authority. Admin support is the operator path for issues from both portals.

## Visual and interaction contract

### Screen and navigation patterns used

1. **Responsive application shell:** persistent grouped sidebar on wide viewports; compact header plus horizontal task navigation on phones; no compressed desktop rail on mobile.
2. **Product/environment switcher:** Developer and Sandbox are separate origins with the active environment made explicit.
3. **Operational overview:** one clear page purpose, a service-readiness panel, and an ordered setup path. It is not a generic marketing hero or decorative dashboard.
4. **Workspace detail:** breadcrumb/context, one page heading, short task description, explicit state, and the exact next action or dependency.
5. **Service state:** icon + text + explanation for connected, pending, unavailable, or failed states. A color or a decorative glyph is never the only status signal.
6. **Readiness checklist:** ordered, scannable release gates that explain the dependencies behind disabled operations.
7. **API documentation:** request contract, auth/scope requirements, endpoint map, message lifecycle, and security boundary; draft routes stay labeled draft and cannot be submitted.
8. **Sandbox request/trace:** environment-bound credential, operation, validated request, response/request ID, and redacted correlated logs. Until the backend exists, every request control remains disabled.
9. **Support handoff:** portal-specific category and subject, safe diagnostic guidance, and the existing Admin ticket queue; never ask for secrets or customer message bodies.
10. **Footer and legal links:** help and policy links remain in the footer; no repeated legal navigation in the content header.

### Nantty design primitives

- Palette and system/dark mode: `packages/designTokens/tokens.css` semantic surface, text, border, focus, warning, and brand tokens.
- Web controls and wordmark: `@nantty/web-kit`.
- Web iconography: `@phosphor-icons/react`; each icon has task semantics and is paired with visible text unless the control has an accessible name.
- Mobile iconography: `phosphor-react-native` and `apps/mobile/src/components/icons`.
- Layout uses the token spacing/type/radius scale, a readable content measure, restrained borders, and dense lists/tables. Cards are reserved for separate actions/states.
- Interactive minimum: 44×44 CSS px coarse-pointer target, keyboard focus, visible labels, and semantic `aria-current`, `aria-live`, `role=status`, and heading structure.

### 1. Brand, theme, and assets

- Use `@nantty/design-tokens` semantic tokens and `@nantty/web-kit` primitives. Never introduce a portal-only brand color, arbitrary hex, or a second theme palette.
- Preserve Nantty blue/yellow identity and existing light/dark token mappings. Theme follows the shared system preference and switcher behavior.
- Use the existing Nantty wordmark/symbol for brand identity and the existing Phosphor web icon pack (`phosphor-react-native` in Messenger). Icons are decorative when adjacent text supplies the name; icon-only controls require an accessible name and a 44px coarse-pointer hit area.
- Do not use emoji as interface icons, improvised Unicode glyphs, unrelated logo packs, or color alone to communicate state.

### 2. Application shell and navigation

- Desktop portal shell: persistent, compact left navigation; product/environment identity in the top bar; one primary content column with a readable maximum width; optional right-side contextual help only when it adds task-specific value.
- Mobile portal shell: single compact header, horizontally scrollable primary section navigation, content-first single column, no desktop sidebar squeezed onto the viewport. Preserve safe areas, keyboard access, focus visibility, and 44px touch controls.
- The portal switcher links Developer and Sandbox as distinct origins and always labels the active environment. Production and test must never look interchangeable.
- Primary navigation is organized by task: **Build** (Applications, Credentials, API documentation), **Operate** (Webhooks, Request logs, Usage & billing), and **Test** (Sandbox applications, Explorer, Scenarios, Events, Requests, Guide). Current section uses `aria-current="page"` and a semantic token, not a color-only indicator.
- Keep header, page title, breadcrumb, main content, and footer/support actions in a stable order. Use skip-to-content and a visible keyboard focus ring.
- Landing pages are operational overviews, not oversized marketing hero templates: title and purpose, current service state, ordered next steps, and links to the exact task/documentation.
- Footer contains only working policy/help links and product/environment switch links. Do not put legal links at the top of a page or invent support destinations.

### 3. Information hierarchy and layout

- One `h1` per page; section headings descend without skipping levels. Use the shared type scale and spacing scale.
- Prefer dense, scannable workspaces: labeled sections, concise descriptions, aligned metadata, clear table/list rows, restrained borders, and inline status explanations. Avoid decorative card grids when a list, table, or ordered flow is the better information shape.
- Use cards only for distinct, actionable resources or states. Shared radius tokens are hierarchical; not every surface is pill-shaped. Avoid heavy shadows, repeated gradients, arbitrary padding, and low-information whitespace.
- Desktop breakpoints: 1440px, 1024px, 768px; mobile checks: 390px and 320px. Main content expands only where data benefits from the width; text measure remains readable.
- Reflow tables into labeled key/value rows or allow intentional local horizontal scroll; never cause page-wide horizontal overflow.

### 4. Data and control states

- Every data surface defines loading/skeleton, success, empty, recoverable error/retry, permission denied, and service-unavailable states as appropriate.
- Status includes words and icons (for example, “Not connected” or “Test only”), not just a dot or color.
- Do not fabricate applications, credentials, usage numbers, billing balances, request logs, webhook attempts, customers, or successful test responses. If a service is unavailable, explain the exact missing dependency and link to relevant docs/support.
- Destructive or security-sensitive operations require contextual confirmation and a clear consequence; credential creation/rotation/revocation requires server authorization, audit, and one-time secret display where appropriate.
- Form controls have visible labels, validation adjacent to the field, server error summaries, preserved safe input on retry, and accessible success/error announcements.

### 5. Iconography

- Web uses `@phosphor-icons/react`; Messenger uses the existing `@/components/icons` Phosphor-derived Nantty icon pack. Do not mix icon families within a product surface.
- Match icon semantics to the task (key for credentials, code for apps/docs, webhook/network for delivery, chart for usage, flask/play for sandbox scenarios, chat for Messenger). Keep stroke weight/size consistent and never use an icon to imply a feature is active when its service is disconnected.

## Required end-to-end journeys

### Developer workspace

1. Sign in using the shared identity provider and select an authorized organization; enforce membership/role on the server.
2. Register an integration application with name, purpose, callback origins, selected environment, and requested least-privilege scopes.
3. Show review state and explain any denied scope. Do not issue credentials before approval.
4. Create environment-specific credentials; show a secret once only; support rotation/revocation, scope review, expiry, and audit history.
5. Configure webhooks: validate public HTTPS URL, prevent localhost/private/reserved IPs and DNS rebinding, select allow-listed event types, verify endpoint ownership, sign deliveries, and expose bounded retries/dead-letter state.
6. Inspect request logs by request ID, application, environment, time, and response class; redact secrets, message bodies, and personal data by default.
7. View server-recorded usage, quotas, entitlements, invoices, and spend controls. Do not hardcode plan prices or usage totals.
8. Link a portal issue to Admin support with product, environment, request/delivery ID, severity, reproducible steps, and redacted diagnostics.

### Sandbox workspace

1. Create a sandbox-only test application and test credential with visibly distinct prefixes/labels.
2. Select a documented API operation, inspect scope/auth requirements, and construct a request from a versioned schema.
3. Validate method, path, headers, body, and idempotency key before submission. Reject production hosts, credentials, IDs, and customer data.
4. Execute only against the separately deployed sandbox service and isolated synthetic data plane; show the returned status, response, request ID, latency, and redacted logs.
5. Run deterministic scenarios and inspect generated signed webhook events, retries, and delivery attempts.
6. Reset sandbox data with explicit confirmation. Preserve request/event correlation for debugging without retaining secrets.
7. Route an issue to Admin support with sandbox environment and request/event IDs.

Until these services exist, present these as planned flow steps with explicit disabled/not-connected state; never display a fake “success.”

### Messenger

- Reuse existing Nantty sign-in/session, conversation APIs, encrypted message format/key management, realtime authorization, offline queue/idempotency, and shared Stories. Do not create a second identity or plaintext fallback.
- Primary journey: authenticate → conversation list/search → open conversation → sync by cursor → compose/send encrypted message → receive authorized realtime event → reconnect/resync → report/block/manage conversation.
- Message content uses distinct, accessible rows for text, link previews, shared posts/reels/products/profiles, media, voice notes, and system state. Preview cards show verified source identity, safe title/domain, and tap destination; external URLs are sanitized and internal links use Nantty routing.
- Long conversation feeds are virtualized/paginated and preserve scroll anchor when loading older messages. Realtime arrivals do not steal scroll from a reader who moved away from the newest message.
- Group/channel invitations are explicit pending records; accepting must complete the E2EE key/epoch handoff before membership or historical access is granted.
- Maintain a standalone lightweight shell and test bundle/startup/memory targets; do not claim the <20 MB APK goal until a release artifact is measured.
- The separate `apps/messenger` Expo foundation currently covers auth shell and inbox projection only. It is not the Business Messaging API, and it is not yet the complete conversation/Stories client.

### Business Messaging API portal status

- `/messaging` in Developer is documentation for the proposed API contract only. It includes an example request, endpoint map, scopes, lifecycle, privacy boundary, and support path, with a visible “draft / requests disabled” state.
- `/messaging` in Sandbox describes the isolated message scenario prerequisites. No synthetic event or successful API response is fabricated.
- Existing internal Social conversation routes and the first-party store inbox are not a public third-party integration contract. The support service now recognizes `developer` and `sandbox` ticket categories; Admin has corresponding filters/macros. This does not make public API operations live.

## Public API documentation and request contract

- Publish OpenAPI schemas before enabling the explorer. Every endpoint documents method/path, auth, environment, scopes, ownership/consent rules, request/response schema, errors, rate limits, idempotency, pagination, and version/deprecation policy.
- A request surface must display environment, method, path, required scope, credential source, body editor, validation, timeout behavior, request ID, redacted request/response, and retry/idempotency guidance.
- Common error envelope is versioned and stable; document authentication, forbidden scope, consent/window, validation, conflict/idempotency, rate-limit, unavailable, and internal errors.
- API keys and webhook secrets never enter URL/query parameters, analytics, browser local storage, crash reports, or copyable logs. Use secure server-issued credentials and redact in all displays.
- Outbound webhook URL validation must resolve and validate every address at connection time and on redirects/retries; block private/reserved ranges, metadata endpoints, localhost, unsafe schemes, and DNS rebinding. Sign timestamped payloads and reject stale/replayed deliveries.
- Do not expose personal E2EE conversations to a business API. Business-managed messaging is a distinct consented trust mode with disclosed retention and human/automation handoff.

## Verification checklist

- [ ] Portal desktop and mobile header/navigation are consistent with Nantty web/mobile semantics and icon families.
- [ ] Light, dark, system, increased contrast, reduced motion, keyboard, and screen-reader paths are checked.
- [ ] 320, 390, 768, 1024, and 1440 CSS-pixel viewports have no unintended overflow or clipped controls.
- [ ] Every portal flow has service-backed states; disconnected functionality is honest and non-interactive.
- [ ] Admin can triage Developer and Sandbox tickets using authoritative support data and redact credential/body secrets.
- [ ] Messenger performs the shared-identity/encrypted-message flow without forking APIs or history.
- [ ] Docs and OpenAPI are checked against implemented routes and integration tests before launch.
