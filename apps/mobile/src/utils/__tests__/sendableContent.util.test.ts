import { hasSendableContent } from "../sendableContent.util";

test.each([
  ["empty", "", false],
  ["undefined", undefined, false],
  ["spaces, tabs and newlines", " \t\n  ", false],
  ["no-break and ideographic spaces", " 　 ", false],
  ["zero-width characters only", "​‍﻿️", false],
  ["single letter", "a", true],
  ["single letter padded with whitespace", "  a \n", true],
  ["single emoji", "😀", true],
  ["emoji with skin tone", "👍🏽", true],
  ["ZWJ family sequence", "👨‍👩‍👧", true],
  ["heart with variation selector", "❤️", true],
  ["non-Latin script", "你", true],
])("%s → %s", (_label, input, expected) => {
  expect(hasSendableContent(input)).toBe(expected);
});
