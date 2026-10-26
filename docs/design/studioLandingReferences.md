# Studio landing: references and decisions

Page: `apps/studio/src/app/page.tsx` (components in `apps/studio/src/components/landing/`). Photo credits: `apps/studio/mediaCredits.json`.

## Family first

Studio sits next to the other Zudomart landings and reuses their system rather than inventing a new one:

| Element | Source it matches |
| --- | --- |
| Floating deep-blue glass header pill, yellow Sign in, yellow round menu button, full-screen brand-blue mobile menu | `apps/seller` `landingHeader` (same CSS) |
| Mono uppercase ticker band with yellow dots | `apps/seller` `landingTicker`, `apps/web` category marquee |
| Inter only, 800 weight, -0.045 to -0.055em tracking, 13 px uppercase brand eyebrows, `clamp(2rem, 4.6vw, 3.4rem)` section headings | seller and web section heads |
| `--landing-width: 1200px`, `--landing-gutter`, `--landing-section-space` | seller `landingPage.module.css` |
| 20 px cards with an inset border, text on top and a visual on a brand or yellow wash below | seller features and access steps |
| Brand-blue stage panel behind framed product UI with floating chips | seller hero, web hero |
| Yellow highlight on one hero word | web hero ("watch.") |
| Deep-blue full-bleed band for money talk | seller pricing, web escrow section |
| Two-column FAQ with sticky intro and `details` rows | seller and web FAQ |
| Brand-blue CTA panel with a photo half, yellow primary and glass secondary | seller CTA |
| Deep-blue footer: wordmark, description, both contact emails, three link columns, copyright, theme switcher, giant wordmark | seller and web footers |

Header and footer markup is now duplicated across seller, ads, web and studio. Lifting them into `@zudomart/web-kit` (props: product label, nav links, link groups, giant word) is a good follow-up, done when no other agent is editing those apps.

## Streaming and creator pages studied

- Twitch creators: https://www.twitch.tv/creatorcamp
- Kick: https://kick.com/
- YouTube Creators: https://www.youtube.com/creators/
- TikTok LIVE Studio: https://www.tiktok.com/live/studio
- Streamlabs: https://streamlabs.com/
- StreamYard: https://streamyard.com/
- Restream: https://restream.io/
- Patreon: https://www.patreon.com/

## Patterns adopted

1. Hero with real product UI and real creators: a live battle frame built in HTML/CSS (LIVE badge, viewer count, blue vs yellow score bar, timer, gift combo toasts, gift goal) over Unsplash creator photos, plus a phone live and an example earnings card (StreamYard, TikTok LIVE Studio, Patreon).
2. Credibility strip: no fake logos or user counts. A ticker of concrete capabilities instead (Restream and StreamYard put proof right under the hero; we only state facts we can back).
3. "Go live your way": tabs that swap the visual between phone, OBS/WHIP (real Studio control room screenshot) and multi-guest (TikTok LIVE Studio, Restream Studio).
4. Feature bento with live demo visuals for gifts, battles, overlays, moderation, leaderboards, replays, analytics and the Blue checkmark (Streamlabs, Kick).
5. Earnings explainer with three streams and transparent payout terms on one card (YouTube "Earn" pillar, Patreon membership story).
6. Creator categories carousel with photography: talk, music, gaming, education, IRL, behind the scenes (YouTube creator gallery, Patreon creator cards).
7. Three real steps, numbered because order matters: join the Creator Program in the app, sign in, go live (YouTube "how it works").
8. FAQ and a final CTA panel repeating the primary action.
9. Testimonials omitted: we have none that are real.

## Copy principles

- Short, punchy headlines that name an outcome: "Go live. Get gifted. Get paid.", "On air in seconds, from any setup.", "Get paid for every gift."
- Benefit-led subheads in the creator's words; no internal terms (no "RTMP ingest", "webhooks").
- One clear primary action per section, always the same label: "Go live with Studio" (to `/login`). Secondary is always "Join the Creator Program".
- Scannable blurbs: one or two sentences, verbs first.
- Honest numbers only. Example figures are labelled "example". Facts come from the product: up to 10 on stage, 80% of fan subscriptions after app store fees, ₦50 payout fee, Nantty Points are never cash, Zudomart shares eligible ad revenue and does not pay per view, live ads only when the creator opts in.
- Selling is mentioned as optional, never as the point.
- No emojis; vector icons only.

## Imagery rules

- Unsplash License photos only, each verified as free (not Unsplash+) through the public download endpoint, saved as WebP under 250 KB, with photographer, profile and source URL in `mediaCredits.json`.
- Product screenshots are Studio rendered with its own mock data (`public/screens/`).
- Device and browser frames, badges, score bars and earnings cards are HTML/CSS/SVG, not edited images.
