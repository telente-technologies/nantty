# Dark mode plan

Status: shipping (2026-10-03). Tokens and the shared web theme kit have landed; per-app status is in section 6.

## 1. Token architecture

Today every Next app has its own copy of `:root` tokens in `src/app/globals.css`, and they have drifted. Admin's `--blue-50` is `#eef1fe` where the others use `#d2dafd`. `--ink-strong` is `#0a0a14` in webapp and studio but `#000` elsewhere. Radii run 6/8/12 in ads and admin, 8/10/12 in seller, 8/14/22 in webapp and 10/18/28 in web. Mobile has a separate `src/constants/colors.constant.ts`. The plan is one source for all of these.

Create `packages/designTokens` (workspace package `@nantty/design-tokens`):

```
packages/designTokens/
  src/palette.ts        raw ramps (blue, yellow, neutral, success, caution, error); copied from mobile palette
  src/semantic.ts       { light: {...}, dark: {...} } semantic map below
  src/scale.ts          space, radius, type scale, shadow, z-index, motion durations
  build/tokens.css      generated: :root{} + [data-theme="dark"]{} + @media fallback
  build/native.ts       generated: typed objects for React Native
```

Next apps run `@import "@nantty/design-tokens/tokens.css";` at the top of `globals.css` and delete their local `:root` blocks. App-specific tokens such as `--sidebar-width` stay local. Mobile imports `native.ts` through a `useTheme()` hook (section 2).

Semantic tokens (names are final, values are the starting point and must pass AA):

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--color-bg` | `#F7F8FE` | `#0B0D17` | app canvas |
| `--color-surface` | `#FFFFFF` | `#141726` | cards, sheets |
| `--color-elevated` | `#FFFFFF` | `#1C2033` | menus, dialogs, popovers |
| `--color-sunken` | `#F0F2FA` | `#0F1220` | inputs, table headers |
| `--color-text` | `#0A0A14` | `#F2F3F8` | primary text |
| `--color-text-muted` | `#5B5B6B` | `#A9ADC2` | secondary text |
| `--color-text-subtle` | `#68687B` | `#8A8FA8` | metadata (replaces `#909090`/`#8B8B9E`, which fail AA at 3.0 to 3.3:1). Light was `#6E6E80`, which is 4.47:1 on `--color-sunken`, so it was darkened |
| `--color-border` | `#E4E6F2` | `#2A3048` | dividers (decorative, no contrast floor) |
| `--color-border-strong` | `#CDD1E6` | `#353B57` | card and table outlines |
| `--color-border-control` | `#80869F` | `#646C8E` | input, checkbox and switch boundaries (3:1 on canvas and surface) |
| `--color-surface-hover` | `#F4F6FD` | `#1A1E30` | row and menu hover |
| `--color-inverse` / `--color-on-inverse` | `#0B1752` / `#FFFFFF` | `#1C2033` / `#F2F3F8` | inverse bands (footers, tooltips) |
| `--color-skeleton` / `-shine` | `#ECEEF7` / `#F7F8FD` | `#1C2033` / `#262B42` | loading shimmer |
| `--color-brand` | `#2043F5` | `#7B90F9` | text, links and icons. Dark was `#6A82F8`, which is 4.47:1 on `--color-brand-tint`. Fills with white text use `--color-brand-solid` |
| `--color-brand-solid` | `#2043F5` | `#4563F7` | primary buttons (white text 6.6:1 light, 4.8:1 dark) |
| `--color-brand-solid-hover` | `#1B39CC` | `#3A57F2` | primary button hover (darkens in both themes so white text keeps its contrast) |
| `--color-brand-tint` | `#ECEFFF` | `#1A2150` | selected nav, chips |
| `--color-on-brand` | `#FFFFFF` | `#FFFFFF` | |
| `--color-accent` | `#F5E320` | `#F5E320` | yellow; text on it is always `#0A0A14` |
| `--color-success` / `-tint` / `-text` | `#10B981` / `#E7F8F1` / `#067A55` | `#34D399` / `#0E2A22` / `#6EE7B7` | use `-text` for words; `#10B981` on white is 2.5:1 |
| `--color-warn` / `-tint` / `-text` | `#F59E0B` / `#FEF4E2` / `#8A5100` | `#FBBF24` / `#2E2410` / `#FCD34D` | |
| `--color-danger` / `-tint` / `-text` | `#EF4444` / `#FDECEC` / `#B91C1C` | `#F87171` / `#2E1416` / `#FCA5A5` | |
| `--color-overlay` | `rgb(10 10 20 / 0.5)` | `rgb(0 0 0 / 0.65)` | scrims |
| `--color-focus` | `#2043F5` | `#8FA1FA` | focus ring |
| `--shadow-*` | navy-tinted | shadows become `0 0 0 1px var(--color-border)` plus a darker drop | depth comes from surface steps |

Keep the raw ramps (`--blue-500`) exported for illustrations, but lint against them in component CSS (see Rules).

## 2. Switching

The preference is `light | dark | system` (default `system`). It is stored per user on the server profile (`preferences.theme`) so it follows the account across mobile, webapp, studio, seller, ads and admin. A local copy is kept for first paint.

Web (all Next apps):
- Add a `theme` cookie (not localStorage) so server components can render `<html data-theme="…">` with no flash. When the value is `system`, omit the attribute and let `@media (prefers-color-scheme: dark)` apply `:root:not([data-theme="light"])`.
- Add a tiny inline `<script>` in `layout.tsx` `<head>` only as a fallback when the cookie is missing. It reads `matchMedia` and sets `data-theme` before paint.
- Set `<meta name="color-scheme" content="light dark">` and `<meta name="theme-color">` per scheme. Set `color-scheme` on `:root` per theme so native controls and scrollbars follow it.
- Add a Light/Dark/System control in each app's user menu or settings. It writes the cookie, PATCHes the profile, and updates the attribute live.

Mobile:
- `ThemeProvider` uses `useColorScheme()` plus the stored override (MMKV/SecureStore key in `storageKeys.constant.ts`) and exposes `useTheme()` returning `{ colors, scheme }`.
- `app.json` already has `userInterfaceStyle: "automatic"` while the UI is light-only. Until dark ships, set it to `"light"` so system dark mode can't produce mismatched native chrome.
- `expo-status-bar` style comes from the scheme (`components/ui/screen.tsx`). `NavigationContainer theme` in `navigation/root.navigator.tsx` maps to `DarkTheme`/`DefaultTheme` with our colors.
- Migration pattern: replace module-level `StyleSheet.create({ color: colors.x })` with `const styles = useThemedStyles(makeStyles)`. 265 files import `colors.constant`.
- Split the overloaded `colors.white` (185 uses). It means both "surface" and "text on brand", so it becomes `surface` vs `onBrand`. Do the same for `colors.black` (37 uses) and `text`.

## 3. Rollout order and effort

| # | App | Effort | Hotspots |
|---|---|---|---|
| 0 | `packages/designTokens` + lint rule | S (1–2 d) | n/a |
| 1 | admin | S–M | Already has a night palette (`--console-night*`). Hex in `shell/sidebarNavigation`, `environmentBadge`, `auth/authCard`, `ui/button`, plus 3 TSX files with inline hex. Internal tool, so lowest risk and a good pilot. |
| 2 | seller | M | 144 raw hex in CSS modules. `layout/sidebarNavigation`, `landing/landingHero`, `landing/landingHeader`, `orders/packingSlipView` (printing stays light: force `data-theme="light"` in print CSS). |
| 3 | ads | M–L | 131 raw hex. `creative/adPreviewSurfaces` (26) and `adPreview` (18) mimic the in-app look, so drive them from the same tokens. `landing/landingIllustrations` (17). Charts in `charts/lineChart.tsx` need `--chart-*` dark values. |
| 4 | webapp | M | 57 hex. `ui/feedback`, `ui/phoneFrame`, `feed/postCard`, `(auth)/authLayout`. |
| 5 | studio | S–M | `auth/authSplitLayout` (16), `landing/landingHero` (8), `ui/feedback`. The control room and overlay pages are dark-first already, so tokenise but keep them dark. |
| 6 | mobile | L (2–3 wk) | 265 static-style files, 185 inline hex in 124 TSX files (mostly generated icons, which should take `color` props). `live/gifts/liveGiftArtwork.tsx` (30) is artwork, so leave it. Needs Figma sign-off (section 5). |
| 7 | web landing | S, optional | Marketing pages are art-directed; `appDownloadCallToAction`, `escrowReceiptDemo`, `siteHeader`. Could stay light-only. |

## 4. Rules

- AA in both themes: body text 4.5:1, large text and UI boundaries 3:1. Add a token test that computes every text/surface pair in `semantic.ts` and fails CI below threshold.
- Never put status colours (`success`/`warn`/`danger` base) on text. Use the `-text` variants. Today webapp has 8 and studio 11 such cases (for example studio "Won"/"Lost").
- Images, video, product photos, avatars and user content are never filtered or inverted. Give media containers a `--color-sunken` placeholder and no white borders.
- Brand blue `#2043F5` on dark navy is 2.5:1, so on dark backgrounds use `#7B90F9` for text and links and `#4563F7` for filled buttons. Yellow stays as is, always with dark text.
- Charts: series colours come from `--chart-1..n` with dark variants. Gridlines use `--color-border`, axis labels `--color-text-subtle`, and nothing relies on colour alone (keep labels and patterns).
- Live, reels and studio control room are already dark-first: they keep their dark surfaces in both themes and only consume tokens for consistency.
- Stylelint rule: no raw hex or `rgb()` in `*.module.css` outside `packages/designTokens` and an allowlist (illustrations, print, artwork).
- Respect `prefers-contrast: more` by stepping `text-muted` and `border` one notch stronger.

## 5. Figma constraint (mobile)

Mobile is built pixel-exact from Figma file `4lzFdjt4oRgyuOIuPTePLl`, and Figma defines light mode only. Dark values for Figma screens need design sign-off: either a Figma dark variable mode, or written approval to derive them from the semantic table above. Until then:
- Light mode stays byte-identical to Figma. The token migration must cause zero visual diff in light (verify with screenshot diffs).
- Dark mode can ship first on non-Figma screens (orders, checkout, escrow, disputes, wallet, seller, creator, support) behind a feature flag.
- Figma's `#909090` metadata text fails AA (3.0:1 on `#F7F8FE`). Flag it to design. Don't change it unilaterally on Figma screens.

## 6. Implementation status

Shared pieces (2026-10-03):
- `packages/designTokens/tokens.css`: light `:root`, `:root[data-theme="dark"]`, the `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` fallback for `system`, `prefers-contrast: more` steps, and `color-scheme` per theme. Charts use `--chart-1..5`, `--chart-compare`, `--chart-grid` and `--chart-axis`, and each has a dark variant.
- `@nantty/web-kit` theme API (stable):
  - `parseThemePreference(cookieValue)` and `readHtmlThemeAttribute(preference)` give server layouts `<html data-theme>`. Add `suppressHydrationWarning` on `<html>`.
  - `<ThemeInitScript nonce? />` goes in `<head>`. It is the pre-paint fallback for static pages and stale caches: it reads the `theme` cookie and sets `data-theme` and `theme-color`.
  - Spread `themeViewport` into `export const viewport`. It sets `color-scheme: light dark` and a per-scheme `theme-color`.
  - `<ThemeProvider initialPreference onPreferenceChange>` and `useTheme()` return `{ preference, resolvedTheme, setPreference }`. It writes the `theme` cookie (1 year, Lax), updates the attribute and `theme-color` live, follows OS changes while on `system`, and calls `onPreferenceChange` so signed-in apps can PATCH `…/users/me/preferences` with `{ theme }`.
  - `<ThemeSwitcher label? showLabel? iconOnly? />` is a Light / Dark / System radiogroup.
  - Skeleton, empty and error states, the wordmark and the cookie banner are fully tokenised.

| App | Status | Preference endpoint (BFF) | Notes |
|---|---|---|---|
| mobile | Beta (default Light) | `PATCH /api/v1/users/me/preferences { theme }` (mock) | Light unchanged. Dark follows Figma node 874:5002 (owner decision): canvas `#0E0E10`, surface `#2C2C2C`, derived greys, brand `#2043F5` fills and yellow kept. Grey text lightened for AA: `@handle` `#5B5B5B`→`#B3B3B3`, metadata `#909090`→`#A6A6A6`. Blue text `#7A8DF9` pending design confirmation. Mobile-only; `designTokens` untouched. `app.json` stays `"light"` until visual QA. See plans.md §27. |
| web (marketing) | Shipped | none (no sign-in) | Stays static: there is no `cookies()` read, so `ThemeInitScript` applies the cookie before paint. The switcher sits in the header and footer. Dark is art-directed (navy canvas, deeper brand bands, solid glass header over the yellow hero) |
| studio | Shipped | `PATCH /api/v1/users/me/preferences` | The switcher is in the shell, the landing header and auth. The control room, overlay editor and stream overlays stay dark in both themes |
| seller | Shipped | `PATCH /seller/users/me/preferences` (signed_in) | Now imports `@nantty/design-tokens`. The switcher is in the top bar, account settings and the landing footer. Print (packing slips, statements, barcode labels) is forced to light paper tokens |
| ads | Shipped | `PATCH /ads/users/me/preferences` (signed-in path) | The switcher is in the user menu and the Settings > Appearance card. Ad previews and charts are driven by `--chart-*` tokens. The top bar fits at 390 px |
| admin | Shipped | `PATCH /admin/users/me/preferences` (anyAdmin, listed before `/admin/users`) | The nonce is passed to `ThemeInitScript`. The `--console-night*` rail stays dark in both themes. The switcher is in the console top bar and the account page |
| webapp | Owned by the webapp workstream | `PATCH /bff/.../users/me/preferences` | Consumes the same kit |
| mobile | Not started | n/a | Waiting on Figma sign-off (section 5) |

Out of scope by design: brand and document artwork (`brandDocumentArtwork`, `verificationDocumentArtwork`), OG images, barcodes and live stream overlays keep their literal colours.
