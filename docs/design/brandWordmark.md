# Zudomart brand guide

> **Status:** The owner approved these marks on 4 Oct 2026. A professional designer still has to polish the marks, and a trademark search is still pending. Do not register or print the marks at scale until both are done.

## Marks

| mark | what it is | source |
|---|---|---|
| Symbol, "Call and response" | Two half-rings, one rising and one answering, cut apart by a narrow gap. It refers to call and response, the West African song form: someone posts, someone replies. | `packages/webKit/src/brand/zudomartSymbol.path.ts` (`zudomartSymbolPath()`, default `callResponse`) |
| Wordmark, Signature brush | Hand-drawn connected script, 11° slant, thick downstrokes and thin upstrokes. The `r` runs into the `t` bar and the `t` ends in a rising swash. | `zudomartBrand.path.ts`, variant `signatureBrush` (the default) |
| Lockup | The symbol in front of the wordmark. The symbol is 62% of the wordmark's height, with a gap of 0.25× the wordmark's height. | `ZudomartWordmark withSymbol` (web). Files: `docs/assets/brand/zudomartLockup.svg`, `zudomartLockupOnDark.svg` (also `.png`) |
| App icon | A white symbol on a flat Ultramarine tile, with no gradient and no accent. | `docs/design/assets/zudomartAppIcon.svg`, generated PNGs in each app |

The other wordmark variants (`classic`, `signature`, `linked`, `smile`, `signatureMonoline`, `signatureCalligraphic`) and the other round 2 symbols stay in the brand files as unused history. Do not ship them. The old `z` tile and the round 1 icon concepts, including Chat bag, have been deleted.

## Construction of the symbol

The symbol sits on a 1024 tile with a 16 × 16 grid.

- Each half is a semicircular stroke: centreline radius 140, stroke width 150, round terminals.
- The left half opens downwards and the right half opens upwards. Their centres sit 280 apart horizontally and 52 apart vertically, and that vertical gap is the cut between them.
- All curves are circular arcs, and the whole symbol fits inside the adaptive-icon safe radius of 300/1024.
- The animation idea: the two halves drift in from either side, ripple once and lock together. The download end card uses this.

The construction drawings are in the session scratchpad (`wordmark/logoRound2Construction.png`). The designer should redraw these as clean master artwork.

## Clear space and minimum sizes

- Clear space: keep at least the height of one half-ring (about 0.4× the symbol's height) clear on every side. For the lockup, the clear space is the wordmark's x-height.
- Symbol alone: 16 px minimum, for favicons and tab bars.
- Wordmark: 18 px tall minimum. At 28 px and below, `zudomartWordmarkFor()` switches to the heavier optical-small cut automatically.
- Top bars: the wordmark at 20 px. Below a 380 px window width, show the symbol tile (`ZudomartLogoMark`) instead.
- App icon: designed for 1024 and checked at 180, 60 and 29 px.

## Colour

One flat brand colour, Ultramarine `#3A2BFF`. Tokens: `packages/designTokens/tokens.css` and `native.ts` (`brandPalette`, `lightColors`, `darkColors`).

| token | light | dark |
|---|---|---|
| brand (text, links, icons) | `#3A2BFF` | `#9C95FF` |
| brand solid (buttons) | `#3A2BFF` | `#4E40FF` |
| solid hover | `#3024D2` | `#6155FF` |
| solid pressed | `#271DA6` | `#3A2BFF` |
| tint | `#EFEEFF` | `#1E1A52` |
| focus ring | `#3A2BFF` | `#A6A0FF` |

The scale runs 50 to 900: `#D8D5FF #C4BFFF #A6A0FF #8980FF #6155FF #3A2BFF #3024D2 #271DA6 #201884 #181263`.

### Contrast (WCAG 2.2)

| pair | ratio | result |
|---|---|---|
| `#3A2BFF` on white | 7.07 | AA, and AAA for text |
| `#3A2BFF` on `#F7F8FE` page | 6.67 | AA |
| `#3A2BFF` on tint `#EFEEFF` | 6.18 | AA |
| white on `#3A2BFF` (button) | 7.07 | AA |
| `#9C95FF` on `#0E0E10` | 7.49 | AA |
| `#9C95FF` on `#2C2C2C` | 5.42 | AA |
| `#9C95FF` on `#141726` / `#1C2033` | 6.91 / 6.26 | AA |
| white on `#4E40FF` (dark button) | 6.00 | AA |
| white on `#6155FF` (dark hover) | 4.94 | AA |
| `#3A2BFF` on `#0E0E10` | 2.73 | fails, so dark mode uses `#9C95FF` for text and links |

Success, warning, danger and the verification badges (Blue, Gold, Black) are separate semantic colours. Do not recolour them with the brand.

## Do

- Use the symbol in white on Ultramarine, Ultramarine on white, or one solid colour (black or white) when only one colour is available.
- Use the lockup on landing pages, emails, the README and press material, and the wordmark alone in product top bars.
- Keep the gap between the two halves. The gap is part of the mark.
- Use the wordmark (never typed text) wherever "Zudomart" appears as branding: top bars, auth and splash screens, loading screens, dashboard sidebars, landing navs and footers, email headers, the download badge and end card, OG images. Every wordmark SVG carries the accessible name "Zudomart".
- In sentences, terms, privacy text, email footers and the legal company name, keep "Zudomart" as plain text.

## Don't

- Add gradients, glows, shadows, outlines or a second accent colour.
- Rotate, mirror, stretch or close the gap in the symbol.
- Typeset "zudomart" in a font where the wordmark should be. Use the paths.
- Put the Ultramarine symbol on mid-tone or busy photos. Use white on a scrim instead, as the download badge does.
- Use the brand colour for success, error or verification states.

## Where it is wired

- Web: `ZudomartWordmark` (with optional `withSymbol`), `ZudomartLogoMark` and `ZudomartSymbol` from `@zudomart/web-kit`. Landing headers for web, studio, seller and ads use the lockup.
- Mobile: `apps/mobile/src/components/brand/zudomartWordmark.tsx`. The home bar shows the wordmark at 20 px, or the symbol tile below 380 pt.
- App icons: `apps/mobile/assets` holds the iOS icon, the Android adaptive foreground, background and monochrome layers, the splash image and the favicon, all set in `app.json`. These need a new native build.
- Web icons: each app's `public/brand/` folder holds the favicon, SVG icon, apple-touch icon, 192/512 icons and a maskable icon. `manifest.webmanifest` and the layout metadata point to them.
- Emails: the header loads `brand/zudomartLockup@2x.png` from `ZUDOMART_EMAIL_ASSET_BASE_URL`. Setting `ZUDOMART_EMAIL_LOGO_URL=none` switches to the text wordmark.
- Download watermark: `services/typescript/media` rasterises the wordmark with sharp and caches it per size. The badge is the symbol tile plus the wordmark. The end card ripples the two halves together, then fades in the wordmark.
