# iOS Liquid Glass scope for Nantty's Expo app

Status: implementation scope, not a claim that the experience is already implemented.

The maintained iOS client is the Expo/React Native app in `apps/mobile`. Its
existing brand colors, typography, icon pack, and navigation structure remain
the source of truth. Liquid Glass is a native iOS material treatment, not a new
Nantty brand color or a reason to put translucent panels behind all content.

## Where to apply it

- Prefer system-provided glass/material behavior for iOS navigation and tab
  controls when the installed React Native/Expo version exposes the native
  platform treatment reliably.
- Evaluate compact floating controls and transient overlays (for example,
  contextual media controls) individually. Keep text, feed cards, product
  tiles, forms, and long-lived surfaces on Nantty's existing opaque theme
  surfaces for legibility and visual continuity.
- For Feed-to-Mart transitions, preserve the existing destination/navigation
  semantics. Use native-feeling transitions only where the current navigator
  supports them; do not add a custom glass layer to simulate navigation.
- The header may use a material treatment only if it is a true system chrome
  surface and remains legible over scrolling content. The Nantty wordmark and
  existing brand palette must remain unchanged.

## Platform and accessibility rules

- Gate any API or effect by OS/runtime support and keep a visually coherent
  fallback on older iOS versions and Android.
- Honor Reduce Transparency, Reduce Motion, increased contrast, Dynamic Type,
  safe areas, and VoiceOver focus order. A material cannot be the only source
  of contrast or state indication.
- Avoid custom blur stacks, continuously animated material, and full-screen
  backdrop blur; favor native controls and measure scrolling/render cost on
  supported iPhone and iPad sizes.
- Keep the Expo widget extension under `apps/mobile/targets/widgets`; it is
  part of the maintained RN app and is not in the retired standalone SwiftUI
  project scope.

## Verification before implementation

Check the current Expo SDK and React Native navigation/material APIs against
Apple's current platform guidance before coding. Verify light/dark themes,
small and large iPhones, iPad layouts, VoiceOver, Reduce Transparency, and
Reduce Motion in an iOS simulator. Do not claim Liquid Glass support where the
runtime falls back to an ordinary material.

References: [Apple App design and UI](https://developer.apple.com/documentation/technologyoverviews/app-design-and-ui),
[SwiftUI apps](https://developer.apple.com/documentation/technologyoverviews/swiftui),
[Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass),
and [iOS development](https://developer.apple.com/ios/).
