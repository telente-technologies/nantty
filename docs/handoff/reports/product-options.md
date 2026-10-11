# Product options: chips instead of comma lists

Comma-separated option fields are replaced on both platforms by option groups. Each group has a name (quick chips: Size, Colour, Storage, Material, Custom, or free text) and an "Add value" input that turns values into removable, reorderable chips.

## Limits (taken from catalog's `productUpsert.validator.go`)
- 3 option groups.
- Option names of 1–30 bytes.
- 1–30 values per option.
- Values of 1–40 **bytes**: Go's `len` counts bytes, so 11 🔥 are rejected.
- At most 100 variants.
- Duplicate values are rejected case-insensitively after trimming, which is stricter than the backend.
- No colour swatch: the product model has no field for it, so it was skipped and the Palette icon is unused.

## Mobile (apps/mobile)
- `src/utils/productOptions.util.ts` (new): the shared pure logic. Covers limits, UTF-8 byte length, paste splitting on `, ; \n`, add/duplicate/cap errors, reorder, combination counting, group errors, and how saved variants map onto edited options.
- `src/components/seller/optionValuesInput.tsx` (new). Values become chips from:
  - Return (`submitBehavior="submit"`, so focus stays and the form does not submit)
  - the Add button
  - typing a comma
  - pasting a list

  A ref guard makes a double-tap on Add and an empty submit no-ops. Each chip has an × labelled "Remove S". Tapping a chip shows Move earlier/later (CaretLeft/CaretRight); screen readers get the same as accessibility actions. Add and remove are announced to screen readers, and errors appear inline under the field.
- `src/components/seller/productOptionsEditor.tsx` (new):
  - groups can be renamed and removed
  - name suggestion chips
  - "Add another option" appears only once the last group has a value, up to 3 groups
  - removals use the shared dialog (`showAlertWithButtons`, intent `remove`) when values or saved variants or stock are affected
- `src/components/seller/productVariantsPreview.tsx` (new): lists the generated variants ("S / Red"). Saved variants show their SKU and stock; new ones show price, stock and "New".
- `productFormFields.tsx` rewritten: `ProductFormValues` is now `{name, description, priceInMajorUnits, stock, optionGroups}`. `onChange` also accepts an updater.
- `productForm.screen.tsx`: two small edits (functional patch, `existingProduct`, a validation message about removed variants with stock). It stays inside `KeyboardAwareForm`.
- `sellerProductForm.util.ts`: options now come from chips. Saved variants are matched by projection, so ids and SKUs survive:
  - renaming an option (via `originalName`)
  - reordering values
  - adding values
  - adding a new option (saved variants take its first value)

  With options unchanged, the result is identical to the old mapping.
- An unsaved value in the input blocks saving with "Tap Add to keep “XL”, or clear it." Whitespace-only input is ignored.
- Removing variants that still have stock gets an inline error before catalog would return `VARIANT_HAS_STOCK`.
- Icons: added `CaretLeftIcon` to the Phosphor glyphs, plus `CaretLeft16Icon`/`CaretRight16Icon`. The icon barrel count went from 185 to 187.
- The mock (`sellerCatalog.mock.ts`) now enforces catalog's option rules.

## Seller dashboard (apps/seller)
- `components/catalog/productOptions.util.ts` (new): the pure logic.
- `optionValuesInput.tsx` (new). Enter adds a value (IME-safe); paste is split; a typed comma also adds. Chips have a DotsSixVertical drag handle using HTML5 drag-and-drop, and arrow keys on the handle reorder. An aria-live region announces changes, and the input has a visible label.
- `productOptionsSection.tsx` rewritten.
- `productOptions.module.css` (new), built on the seller design tokens.
- `productEditorDraft.util.ts`:
  - `OptionDraft` is now `{key, name, values[], pendingText, appliedName}`
  - `applyOptionChanges` replaces `regenerateVariantDraftsForOptions(options, variants)`
  - variant ids are kept across rename and new options
  - variants are not regenerated while a name is blank or duplicated mid-edit, so clearing a name and retyping it does not lose ids
- `productOptionIssues.util.ts` (new): pre-save issues (unsaved text, more than 100 variants, removed variants with stock). Option issues clear when options change.
- `productEditorView.tsx`: wiring only.
- `zudoIcon.tsx`: added `dotsSixVertical16`.
- `utils/productValidation.util.ts`: the option name and value length checks now count UTF-8 bytes, matching catalog.
- Removal confirmations use web-kit `requestConfirmation` (intent `remove`).

## Tests
- Mobile:
  - `utils/__tests__/productOptions.util.test.ts` (new)
  - `sellerProductForm.util.test.ts` (updated, with new cases for rename/extend preserving ids, the stock warning and block, pending text, more than 100 variants)
  - `components/seller/__tests__/productOptionsEditor.test.ts` (new, rendered: Return/Add/comma/paste, duplicate inline, double-tap, empty submit, remove, reorder, 3-group cap, confirmation dialog)
  - `contracts/sellerCatalogMocks.test.ts` (round-trips through the mock, keeps ids on edit, exact request keys, rejects emoji that are too long, duplicates and missing option values)
- Seller:
  - `src/utils/productOptionChips.util.test.ts`
  - `src/contracts/productOptions.test.ts`: request shape, ids/SKUs kept through rename/reorder/new value/new option against the mock PATCH, retyping a name, the blocks, emoji bytes, 4 options

## QA results
- mobile tsc: exit 0. Full mobile jest: exit 0, 94 suites and 564 tests passed.
- seller tsc: 0. units: 11/11. contracts: 52/52. `SELLER_USE_MOCKS=true next build`: 0.
- Off-happy-path cases, all covered by tests:
  - a pasted list of 40–45 values is capped at 30 with "N were left out"
  - emoji values are accepted under 40 bytes and rejected over it
  - removing a value whose variant has stock asks first, then blocks saving with a message
  - a double-tap on Add adds once
  - an empty or whitespace in-progress value is ignored
  - unsaved typed text blocks saving with an inline message
- ESLint: neither app has an eslint.config, so it was not run.

## Notes
- On mobile, price and opening stock are still shared by all variants. Per-variant price and stock edits stay in the seller dashboard's variants table, which is the web variant preview.
- No package.json or lockfile changes. Nothing committed.
