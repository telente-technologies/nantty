# Keyboard covering fields: report

## Expo Go
- `react-native-keyboard-controller@1.21.9` is exactly the version in Expo SDK 57's `bundledNativeModules.json`. The app already mounted `KeyboardProvider` at the root, and the owner's Expo Go runs never crashed with the error "doesn't seem to be linked". That suggests the module is present in Expo Go, but I could not check it on a device.
- I still made it safe in case it isn't. All keyboard APIs now go through `src/components/ui/keyboardController.ts`:
  - It looks for the native module through `TurboModuleRegistry` or the older `NativeModules` table.
  - It loads the library only when the module is present.
  - Otherwise it falls back. The provider becomes a pass-through. The hooks use RN's `Keyboard` events, and on Android they rely on the window resize, so nothing lifts twice. `KeyboardAwareForm` uses RN `KeyboardAvoidingView` plus a ScrollView that scrolls the focused input into view.
- `App.tsx` keeps `<KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>`, now imported from the adapter.
- Android: `softwareKeyboardLayoutMode: "resize"` is kept. A prebuild into a scratch copy produced `windowSoftInputMode="adjustResize"` and `edgeToEdgeEnabled=true`, which is the combination keyboard-controller needs. The scratch copy has been deleted.

## Shared building blocks (src/components/ui)
- `keyboardAwareForm.tsx`
  - `KeyboardAwareForm`: the library's `KeyboardAwareScrollView` with `bottomOffset` 24. If you pass a `footer`, it rides above the keyboard (`KeyboardFloatingFooter`), and the offset grows by the footer's height. It pads the bottom safe area itself unless you pass `safeAreaHandledByParent`.
  - `KeyboardScrollScreen`: `Screen` + header + form in one.
- `keyboardStickyFooter.tsx`
  - `KeyboardStickyFooter`: a push-style footer that rests on the safe area. Takes a `safeAreaHandledByParent` flag and an `offset` for the tab bar.
  - `KeyboardFloatingFooter`: the translate-style footer used inside forms.
- `keepFocusedInputVisible.hook.ts`: scrolls the focused input to 24pt above the keyboard inside sheets and modals. It is clamped to the real content, so it never scrolls past the end.
- `keyboardSpacer.tsx`: now goes through the adapter.
- `bottomSheet.tsx` and `fullScreenModal.tsx`: scrollable content now reveals the focused field, and both still lift with `KeyboardSpacer`.
- Tap-outside dismissal, `keyboardDismissMode` on threads and the `focusRequest` composers are unchanged.

## Screens and fixes
| Area | Files | Fix |
| --- | --- | --- |
| Auth: login, sign-up steps, forgot/reset, OTP | `authStep.tsx` (all auth screens) | `KeyboardAwareForm` replaces KAV + plain ScrollView; the focused field scrolls into view and the button can be scrolled to |
| Settings: password, username, address, chat passcode and every other `SettingsPage` | `settingsPage.tsx` | `KeyboardAwareForm` |
| Profile edit | `editProfile.screen.tsx` | `KeyboardAwareForm` with a sticky Save button |
| Create brand / business profile, creator application, open dispute, write review, contact support, verification apply, seller application, checkout (Pay) | the respective screens | `KeyboardAwareForm`; the existing bottom button becomes a sticky footer and now pads the bottom safe area |
| Withdraw | `withdraw.screen.tsx` | `KeyboardAwareForm`; the Withdraw / Finish setup button and its error are now sticky |
| Payout accounts, payout setup (bank, business, identity steps), product create/edit, conversation info | the respective screens | `KeyboardAwareForm` |
| New group / channel | `newGroup.screen.tsx` | Create button moved into `KeyboardStickyFooter` |
| New message, connections, help centre, search, sound (owner rename) | the respective screens | `KeyboardSpacer restingHeight={0}` under the list; the sound screen's list also reveals the focused field |
| Chats search, chat lock gate (tab screens) | `chatSearchPanel.tsx`, `chatLockGate.tsx` | Spacer offset by the tab-bar height; the lock gate re-centres above the keyboard |
| Chat composer, story reply, comment/reply composers, clip comments sheet, live comment bar, support/dispute threads, post/clip/story composer | already used `KeyboardSpacer` | Kept; now through the adapter |
| Sheets made `scrollable` (field + primary button stay reachable, focused field revealed) | poll composer, tip, transfer coins, convert coins, buy coins, country required, subscription plan, gift goal, live report, live appeal, report (+ copyright claim), mark as shipped, phone number, step-up code, appeal strike, counter-notice | `BottomSheet scrollable`; doubled horizontal padding removed |
| Search + list sheets | send in chat, sound picker, place search, tag people, bank picker, brand picker, geo picker, share live | Body and list get `flexShrink: 1` so the list shrinks and the field and button stay visible |
| Already fine | delete account, chat report, live monetization, live guests | already scrollable |

Not present in the app (no text input exists): Mart filters, a checkout coupon or notes field, the add-money amount (it is a bank-transfer screen), ads/boost forms, store settings, a country picker search.

## Create-screen regression (owner report)
- I reverted my one change in the Create tree: the reveal hook I had added to `dismissKeyboardScrollView.tsx`. The Create screen is back to its original keyboard handling, which is the existing push spacer only.
- The reveal hook is now clamped so it can't scroll content past its end, and it does nothing for inputs taller than the visible area.
- Native detection is more robust, and the Android fallback no longer lifts twice.
- There is a regression test in `keyboardSafeContainers.test.ts`.
- This is not confirmed on a device. If the header still moves, look at commit 9db9b111c, which changed `createPost.screen.tsx` for quotes.

## Tests
- `src/components/ui/__tests__/keyboardSafeContainers.test.ts` (18 tests) covers:
  - native detection: missing module, web, TurboModule or NativeModules
  - the fallback never loading the library
  - fallback provider and handlers, with the Android no-double-lift rule
  - the form fallback with footer inset 34 vs 0
  - sticky footer inset math and rendering
  - the reveal maths, including the no-overscroll regression
- `src/components/ui/__tests__/keyboardSafeInputs.test.ts` is the source audit:
  - Every file that renders `<TextInput`/`<TextField` must contain a keyboard-safe container, or be rendered only by files that are safe.
  - The allowlist has one entry: `components/ui/input.tsx`, the primitive.
  - It also checks that the containers really handle the keyboard, that only the adapter imports the library, and that `softwareKeyboardLayoutMode` is `resize`.
- Docs: `apps/mobile/README.md` (new file) says which component to use when.

## QA results
- `tsc`: my files are clean. It fails only in `src/utils/sellerProductForm.util.ts` (`optionGroups`), which another agent is changing right now (that file is modified and `optionValuesInput.tsx` is untracked). Before that change landed, `tsc` passed with exit 0.
- Full jest (real exit code): 90 of 91 suites pass and 540 of 543 tests pass. The 3 failures are all in `sellerProductForm.util.test.ts`, which is that same in-progress seller work.
- `expo prebuild --no-install` into a scratch copy: OK (manifest values as above).

## Hand spot-check list (iOS and Android, Expo Go)
1. Create post: the header stays put with the keyboard open, and the caption stays visible.
2. Login and sign-up password on a small phone (SE): the focused field sits about 24pt above the keyboard, and you can scroll to Next.
3. Settings › Password and Address form: the bottom fields scroll into view.
4. Edit profile, Withdraw and Checkout: the bottom button rides on top of the keyboard with no gap. Dragging the keyboard down interactively on iOS should move the button with it.
5. Contact support, Write review, Open dispute: the multiline message stays visible while it grows.
6. Step-up code sheet, Tip, Transfer coins, Report sheet: the field and button are visible above the keyboard. On Android, check there is no double lift inside Modal sheets.
7. Chat composer and the emoji panel, comments sheet reply, live comment bar: no gap and no jump.
8. Chats tab search and the chat lock gate: the content sits right above the keyboard and doesn't overshoot by the tab bar.
9. New group: the Create button sits above the keyboard.
