# UI Reference Audit & Visual Inconsistencies Corrected

## Approved Reference Surfaces Inspected
- `apps/web/src/components/layout/{siteHeader,siteFooter}.tsx` & `apps/web/src/app/globals.css`
- `apps/seller/src/components/layout/{workspaceShell,topBar,sidebarNavigation}.tsx`
- `packages/designTokens/{tokens.css,portalTheme.css,native.ts}` & `packages/webKit/src/`
- `apps/messenger/src/{MessengerRoot,theme}.ts` & `apps/messenger/src/screens/`

## Inconsistencies Found & Corrected on `arena/8e0ba5aa-nantty`
1. **`apps/developer/src/components/developerLanding.module.css` footer & CTA override**: Overrode `.nanttyPortalFooter` with monochrome `--color-text` and styled `.primaryAction` black instead of Nantty brand blue (`--color-brand-solid`) and night-blue footer (`--surface-night`). Removed override and aligned primary actions to `--color-brand-solid`.
2. **`apps/developer` landing & public docs gaps**: Added real OpenAPI-grounded request/webhook snippets, tier overview, FAQ accordion, PKCE SSO sign-in CTA (`/api/auth/login`), and public routes (`/products`, `/products/messaging`, `/pricing`, `/changelog`, `/security`, `/support`, `/legal/developer-terms`, `/legal/acceptable-use`, `/docs/*`).
3. **`apps/developer` shell missing workspace context & environment switcher**: Added `DeveloperContextProvider` with live Organization switcher and `Sandbox` vs `Production` segmented environment toggle in `PortalShell`.
4. **`apps/developer` Production API workspaces**: Wired `/credentials`, `/webhooks` (with `/verify` and `/rotate-secret`), `/requests`, `/usage`, `/billing`, `/onboarding`, `/businesses`, `/audit-logs`, `/sandbox`, and `/invitations/[token]` to real Identity & Sandbox BFF endpoints.
5. **`apps/messenger` business conversation disclosure & inbox filtering**: Updated `ConversationScreen` to disclose `"Consented business conversation"` when `conversation.kind === "business" || conversation.store`, and added `All` / `Unread` / `Businesses` filter tabs to `InboxScreen`.

## Visual Runtime Note
- Browser rendering, Playwright/Chromium screenshots, and Expo mobile emulator previews were **not executed** in this container because `node_modules`, `pnpm`, `tsc`, `go`, and browser binaries are absent. Visual QA remains `UNVERIFIED` until rendered in a full dev/CI environment.
