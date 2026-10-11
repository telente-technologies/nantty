# Zudomart mobile

## Keyboard handling

Every text input must sit inside a keyboard-safe container. `src/components/ui/__tests__/keyboardSafeInputs.test.ts` fails the build when one doesn't.

| Situation | Use |
| --- | --- |
| Form or long screen (settings, auth, checkout, seller forms) | `KeyboardAwareForm` under the `Header`, or `KeyboardScrollScreen` for screen + header + form. Pass the primary button as `footer` to keep it above the keyboard. |
| Settings page | `SettingsPage` (already a `KeyboardAwareForm`) |
| Auth step | `AuthStep` (already a `KeyboardAwareForm`) |
| Bottom composer or action bar (chat, comments, reply, create-group button) | `KeyboardStickyFooter`, or `KeyboardSpacer` directly below a composer that draws its own bar |
| Search field on top of a list | `<KeyboardSpacer restingHeight={0} />` after the list, so the list ends above the keyboard (pass `offset` = tab bar height inside tabs) |
| Sheet with inputs | `BottomSheet` with `scrollable` (and `footerActions` for the primary button). For a search + list sheet, give the list `flexShrink: 1`. |
| Full-screen modal with inputs | `FullScreenModal` (scrollable by default) |

Rules:

- Import keyboard APIs only from `@/components/ui/keyboardController`, never from `react-native-keyboard-controller` directly. The adapter uses the native library when its module is present and falls back to React Native's `Keyboard` APIs otherwise, so nothing crashes where the module is missing.
- Keep headers outside the scrolling or lifting area. Only content below the header moves.
- Tapping empty space dismisses the keyboard (`Screen`, `FrameAwareModal`). Composers focus only on an explicit Reply (`focusRequest`).
- Android uses `softwareKeyboardLayoutMode: "resize"` in `app.json`, which `react-native-keyboard-controller` needs.
