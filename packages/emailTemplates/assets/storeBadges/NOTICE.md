# Official app store badges

These files are the official, unaltered store badges. Do not recolour, crop, stretch, animate or redraw them.

| File | Source | Notes |
| --- | --- | --- |
| `app-store-badge-black.svg` | Apple, App Store marketing resources: https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg (also at https://tools.applemarketingtools.com) | Black "Download on the App Store" badge, US/UK English, RGB, Apple artwork `Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917`. |
| `app-store-badge-black@2x.png` | Rasterised 1:1 from the SVG above at 2x (240 × 80) for email clients that cannot show SVG. | No other change. |
| `google-play-badge.png` | Google Play badge generator: https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png | Official "Get it on Google Play" badge, English, 646 × 250 including Google's built-in clear space. Google distributes the vector badge through the Partner Marketing Hub (sign-in); swap in that SVG when downloaded, unchanged. |
| `google-play-badge@2x.png` | The PNG above, scaled down proportionally to 310 × 120 for email. | No other change. |

## Rules we follow

Apple, App Store marketing guidelines: https://developer.apple.com/app-store/marketing/guidelines/
- Use the black badge; never change its colour, proportions or text. The grey outline is part of the artwork.
- Minimum height 40 px on screen. Clear space around the badge of at least a quarter of its height (10 px at 40 px).
- Link the badge only to the Nantty App Store product page (`https://apps.apple.com/app/id<APP_STORE_ID>`).
- Alt text: "Download on the App Store". Place it before or level with other store badges; do not make it smaller than other badges.
- Legal line where space allows: "Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries and regions. App Store is a service mark of Apple Inc."

Google Play badge guidelines: https://partnermarketinghub.withgoogle.com/brands/google-play/visual-identity/badge-guidelines/
- Use the official badge only, unaltered, with its built-in clear space; show it at the same visual height as other store badges.
- Link it only to the Nantty listing (`https://play.google.com/store/apps/details?id=<PLAY_PACKAGE>`).
- Alt text: "Get it on Google Play".
- Legal line where space allows: "Google Play and the Google Play logo are trademarks of Google LLC."

Both companies license these badges for promoting apps available on their stores. Until the store ids are configured the sites show the badges without a link and label them "Coming soon".
