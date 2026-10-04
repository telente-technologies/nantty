# Dark mode visual scan (overnight step 3, 2026-10-04)

Headless Chromium (puppeteer-core against `/usr/bin/chromium`) drove each Next app in `next dev` with mocks and a signed-in demo session. Every main route was captured in dark and light at 390, 768 and 1440 px by setting the `theme` cookie; interactive states (menus, dialogs, command palette, empty states) were captured with scripted clicks. Screenshots live in `/tmp/claude-1000/-home-oyinlola-Desktop-zudomart/d68ba207-aa17-439a-99ad-9feb94399c13/scratchpad/darkScan/<app>/` as `<route>-<theme>-<width>.png` (state captures carry a `-<state>` suffix). Nothing was committed.

Shared change: `packages/designTokens/tokens.css` gained `--media-frame` (transparent in light, `rgb(255 255 255 / 0.1)` in dark). It is a 1 px inner hairline for photos so product shots on white backgrounds stop reading as glowing white tiles on the navy canvas. Light mode is pixel-identical.

## webapp (port 3500, demo account `me@zudomart.com`)

Routes captured: home, explore, clips, live, mart, cart, checkout, chats and a conversation, notifications, orders and an order, saved, settings (+addresses, privacy), me, creator, store rewards, a product, a post, and logged-out login / signup / forgot-password / welcome. States: post "More options" menu, account menu with the theme switcher, cookie banner and its Manage dialog, Add address dialog, cart remove, add to cart.

What already held up in dark: navy canvas with distinct surface, elevated and sunken steps; AA text everywhere sampled; status pills on the `-tint`/`-text` pairs (Pending, Delivered, Disputed, Completed, Cancelled); unread notification cards on brand tint; the chat bubbles; the progress stepper; the cookie banner and Manage dialog; the Add address dialog (scrim 0.68, surface + strong border, brand focus ring on the first input); native selects on the Saved page follow `color-scheme: dark`; auth pages; the user menu Light / Dark / System control.

Issues found -> fixed:
- Product photos shot on white (sneakers, keyboard, speaker, laptop stand) glared as hard white tiles on the navy canvas in the Mart grid, product gallery and thumbnails, cart and order items, saved tiles and "You may also like". Fix: `MediaImage` (`apps/webapp/src/components/ui/media.tsx` + `media.module.css`) now renders a `pointer-events: none` frame span with `inset 0 0 0 1px var(--media-frame)`, so every image container gets a soft 1 px edge in dark only. Before: `webapp/product_pr_s2-dark-1440.png`, `webapp/mart-dark-1440.png`. After: `webapp/product_pr_s2-after-dark-1440.png`, `webapp/cart-after-dark-1440.png`.

Remaining / notes:
- The toast uses `--color-inverse`, which in dark equals the elevated surface; it still separates through the `--shadow-float` ring but is less punchy than in light. Left as is (owner call: a lighter inverse toast in dark would be the X/Linear pattern, as mobile already does).
- The `N` button at the bottom-left of some captures is the Next dev-tools indicator, not product UI.

## seller (port 3200, `adaeze@ifelifestyle.ng`)

Routes captured: dashboard, orders (+ returns, disputes, an order `ord_0002`, its packing slip), products (+ new, import, `prod_adire_shirt` editor), inventory, customers (+ segments), analytics, marketing discounts and flash sales, promotions, reports, reviews, messages, wallet, settings (+ account, payouts, team), staff, storefront, delivery, brand, affiliates, ads, plus the logged-out landing, login and access application. States: Ctrl K command palette, product row selection bar, orders empty state, team page.

What held up: the `--deep-surface` navy rail in both themes; metric cards, tables, row hover, sortable headers; charts on `--chart-*` (line, area, bar) with legible gridlines and axis labels; date inputs and selects following `color-scheme`; toggles; the yellow "Business" plan pill and the yellow Available-balance highlight; the packing slip stays as white paper on the dark canvas (print tokens forced light); error banners on `--color-danger-tint`; the landing page's art-directed dark.

Issues found -> fixed:
- Command palette: the search input had no background, so it rendered as a light-grey UA field on the dark panel. Fix: `background: transparent` in `apps/seller/src/components/layout/commandPalette.module.css`. Before `seller/dashboard-search-dark-1440.png`, after `seller/dashboard-search2-dark-1440.png`.
- Product thumbnails on white (products table, inventory, dashboard top products, storefront preview, order items) glared. Fix: `img[src] { outline: 1px solid var(--media-frame); outline-offset: -1px }` in `apps/seller/src/app/globals.css` (no-op in light). After: `seller/orders_ord_0002-dark-1440.png`.

Remaining / notes:
- Analytics "Net sales" series dips below the axis on 5-9 Sept with the demo data (a negative net day); the chart clamps nothing. Data/chart issue, not theme.
- Command palette rows right-align their labels with centred icons; looks intentional but worth a glance.
- At 390 the top bar collapses the store switcher to a bare chevron pill; the store name is hidden. Functional, but a tooltip or initials would help.

## studio (port 3600, `creator@zudomart.com`)

Routes captured: lives, a live control room (live and ended), the overlay editor, earnings / payout onboarding, the OBS overlay page, plus the logged-out landing and login.

What held up: the whole app is dark-first and reads as designed in dark; the control room, overlay checkerboard canvas and stream overlays keep their dark surfaces; "Won" / "Lost" and other status words use the `-text` variants; disabled primary buttons (Save overlay, Save and continue, Log in) keep legible text; the payout onboarding form, native select and date field follow `color-scheme`; the demo-mode notice sits on `--color-warn-tint`; the landing's night hero and brand band gradient.

Issues found: none requiring a code change.

Remaining / notes:
- At 390 the login page's theme switcher shares a row with the "Log in" heading and nearly touches it; consider moving it into the split-layout header on small screens.
- "End live" in dark is the pastel `--color-danger` fill with dark text (correct for contrast) but reads softer than the light-mode red; a `--color-danger-solid` token would give a stronger destructive fill in dark.

## mobile (static scan, Expo not run)

Method: `apps/mobile/scripts/reportThemeCoverage.mjs` before and after, an AST-free grep for hex / rgb / `white` / `black` literals in `StyleSheet.create` blocks outside the dark-first folders (live, clips, story) and the non-UI folders (icons, theme, constants, mocks), a grep for `StyleSheet.create` files that do not import `@/theme`, and a read of the colour props in the key screens (feed post card, profile summary, explore/mart showcase, product gallery and price block, cart and checkout, chat list skeleton, chat bubbles, conversation, settings, notifications, wallet, orders, modal chrome for sheets, dialogs and popovers, toast host, live setup, clips sheets, payout onboarding, saved tiles, legal re-accept).

Coverage numbers:

| Metric | Before | After |
| --- | --- | --- |
| UI files considered | 344 | 344 |
| Files importing `@/theme` | 331 | 331 |
| Static `colors.constant` references inside StyleSheets | 0 | 0 |
| Raw colour literals inside StyleSheets | 28 | 27 |
| Dark-first files (skipped) | 71 | 71 |

The 13 `StyleSheet.create` files that do not import `@/theme` (cart screen, header, iconRow, createHeader, productMasonry, storyCapturePanel, coinAmount, moneyAmount, postActionRow, officialStoreBadge, addressGeoFields, settingsPage, clipSoundRow) hold layout-only styles or take colour through props; none paints a hardcoded surface.

Of the 27 remaining literals, 24 are already scheme-aware (`scheme === "dark" ? colors.x : "#figmaHex"` to keep light byte-identical to Figma, or overlays on photos/video such as `rgba(0,0,0,0.45)` scrims and `rgba(255,255,255,0.88)` labels on Mart tiles, which are correct in both schemes). `modalChrome.constant.ts` and `toastHost.tsx` hold their own light/dark pairs by design (the dark toast is an inverse light pill, matching the Figma dark node).

Issues found -> fixed:
- `components/create/liveSetupPanel.tsx`: the credentials card divider was the light `#E4E6F2` hairline on a `colors.surface` card, a bright line on `#2C2C2C` in dark. Now `colors.divider`.
- `components/product/aboutShopCard.tsx`: the dot separator between shop stats was `colors.black`, invisible on the dark surface. Now `colors.textSubtle` in dark, black in light.

Checked and left as is: `themeColors.constant.ts` (Figma greys `#0E0E10` canvas / `#2C2C2C` surface, lightened `#B3B3B3` / `#A6A6A6` text for AA, `#7A8DF9` links), `darkStatusTones`, generated icons (all 100 percent take a `color` prop), `useThemedIconInk` mapping for Figma inks, `app.json` `userInterfaceStyle: "light"` while Dark stays Beta.

Not run: `npx expo export --platform web` (skipped deliberately; the Metro web bundle plus a dev server would have been a second heavy process next to Chromium and the Next dev server).

## ads (port 3300, `adaeze@ifelifestyle.ng`, account `act_ifelifestyle`)

Routes captured: accounts list, overview, campaigns, a campaign, create campaign, an ad (feed preview), audiences, billing, reports, settings & people, activity, conversion events, A/B tests, automated rules, new account, policy, plus the logged-out landing and login. States: account switcher, Add funds dialog.

What held up: the `--console`-style navy rail; metric tiles with the `-text` delta colours; line chart with dashed compare series on `--chart-compare`, horizontal bars on `--chart-1`; pacing bars; delivery toggles and status dots; the in-app ad preview (feed card on `--color-surface`, product photo with its own frame); the yellow "Verified business" and "Gold Premium" pills with dark text; the Add funds dialog (amount chips, selected chip on brand tint, info note on brand tint, sticky footer); the account switcher popover on `--color-elevated` with a hover row; disabled "Save changes" button; the landing's dark hero and the login split layout.

Issues found: none requiring a code change.

Remaining / notes:
- Overview at 390 shows the icon rail plus a 2-column metric grid; "Return on ad spend" and "Cost per click" labels truncate with ellipses at that width. Layout, not theme.
- Objective radio cards in Create campaign have a 1 px `--color-border` outline that is near-invisible on `--color-surface` until hovered; selection state is carried by the radio and tint, so it passes, but a `--color-border-strong` outline would help scanability.

## admin (port 3400, `tolu.adeyemi@example.com` + TOTP `000000`)

Routes captured: overview, users, orders, disputes, payouts, ledger, moderation reports and suspensions, support inbox and live chat, verification, seller applications, brands, categories, feature flags, plans & prices, legal, audit log, admins, account security, ads review, plus logged-out login and the restricted page. States: user row, user menu, feature-flag toggle (step-up dialog).

What held up: the `--console-night` rail and the yellow hazard stripe under the top bar in both themes; "Needs attention" tiles with coloured left rules; metric cards with sparklines; the monospace IDs; status and risk dots; verification badge colours (`--verified-gold` dark variant); the ledger's two-pane layout and "Balanced" pills; the plans editor (checkboxes, inputs, tier-coloured left rules, yellow Gold section); date inputs; the login split layout with the demo-mode notice on warn tint; the Light / Dark / System control in the top bar and on the Security page.

Issues found -> fixed:
- Report and ad-review thumbnails on white (iPhone, Yeezy, Camry) glared. Fix: the same `img[src]` hairline rule as seller in `apps/admin/src/app/globals.css`.

Remaining / notes:
- Live chat at 390 lets the "Last message" column wrap to 6 lines; a `max-width` + ellipsis on that cell would keep rows scannable. Layout, not theme.
- The security page's "Where you're signed in" card prints the full user-agent string; truncating it would tidy both themes.

## web (marketing, port 3100, no sign-in)

Routes captured: home, sellers, about, contact, privacy, terms, cookies, refund and escrow policy, community guidelines.

What held up: the navy canvas with the deeper brand band and the olive "sunshine" panels; the yellow sellers hero stays yellow with dark text and the header becomes dark glass over it; the early-access ribbon; step cards and phone frames on `--device-edge`; the legal pages (draft notice on warn tint, on-page nav, cookie table rules on `--line-hairline`); the footer with the Light / Dark / System control and the giant wordmark.

Issues found: none requiring a code change. Light untouched.

## Summary of code changes (uncommitted)

| File | Change |
| --- | --- |
| `packages/designTokens/tokens.css` | New `--media-frame` token (transparent light, 10 percent white dark) in `:root`, `[data-theme="dark"]` and the `prefers-color-scheme` fallback |
| `apps/webapp/src/components/ui/media.tsx`, `media.module.css` | `MediaImage` renders a non-interactive `.frame` overlay using `--media-frame` |
| `apps/seller/src/app/globals.css` | `img[src]` inner outline on `--media-frame` |
| `apps/seller/src/components/layout/commandPalette.module.css` | Command palette input `background: transparent` |
| `apps/admin/src/app/globals.css` | `img[src]` inner outline on `--media-frame` |
| `apps/mobile/src/components/create/liveSetupPanel.tsx` | Credential divider uses `colors.divider` |
| `apps/mobile/src/components/product/aboutShopCard.tsx` | Stats separator themed for dark |

Not touched: `apps/studio/**` landing files (a separate redesign is in progress; the untracked `apps/studio/mediaCredits.json` and `apps/studio/public/photos/` belong to that work, not to this scan), `services/**`, docker, `next-env.d.ts` files (reverted after each dev run; `apps/studio/next-env.d.ts` was already modified before this scan and was left alone).

## Cross-app observations for the owner

- Dark toasts: webapp and the other Next apps use `--color-inverse` (same as the elevated surface in dark). Mobile uses an inverse light pill. Pick one; the mobile approach reads better on a navy canvas.
- A `--color-danger-solid` token in `designTokens` would replace the three app-local `--danger-solid` overrides (webapp, admin, studio's pastel "End live").
- `prefers-contrast: more` steps text and borders, but no capture was taken with it forced; worth a follow-up pass.
