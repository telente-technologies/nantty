# Nantty brand assets

Use the supplied Nantty identity consistently across the app, websites, email, investor materials and social channels. Prefer the provided artwork over recreating the logo from text or drawing a substitute.

## Source assets

| Use | Asset |
|---|---|
| Light backgrounds and print | `docs/assets/brand/nanttyLockup.png` |
| Dark backgrounds | `docs/assets/brand/nanttyLockupOnDark.png` |
| App icon | `docs/design/assets/nanttyAppIcon.png` |
| Standalone symbol | `docs/design/assets/nanttySymbol.png` |
| Email header, 2× | `packages/emailTemplates/assets/brand/nanttyLockup@2x.png` |

Each app also has optimized copies in its own `public/brand` or native asset directory. Keep those copies synchronized with these source assets when preparing a new build.

## Usage

- Use the light lockup on light backgrounds and the dark lockup on dark backgrounds. Do not place the light lockup on a dark surface or the dark lockup on a light surface.
- Use the standalone icon only where a full lockup does not fit, such as an app icon, avatar-sized brand mark or compact navigation control.
- Preserve the supplied proportions and clear space. Never stretch, recolor, rotate, add effects, or redraw the mark from a typeface.
- Use “Nantty” as the written brand name. Use “Nantty Points” for the non-cash ranking points product.
- Do not ship obsolete brand artwork. Update linked assets and documentation before removing an old asset so there are no broken references.

## Product styling

The logo artwork is the source of truth for the mark itself. App interface colors remain controlled by `packages/designTokens`; do not infer the full UI palette from the logo image. Keep status, warning, error and verification colors semantically distinct from the brand accent.

## Verification before release

- Check the light and dark lockups on their intended backgrounds at desktop and mobile sizes.
- Check app icons at platform-provided small sizes and safe areas.
- Search screenshots, store badges, email templates, Open Graph images and downloadable media for obsolete artwork.
- Confirm that public-facing copy and contact addresses use the current Nantty domain and email addresses.
