import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";

import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/ssr";

import { RepostActionIcon } from "./repostActionIcon";

function pathData(markup: string): string[] {
  return Array.from(markup.matchAll(/<path\b[^>]*\bd="([^"]+)"/g), (match) => match[1]!);
}

test("web repost action uses the same circular arrows glyph as the mobile action", () => {
  const webGlyph = renderToStaticMarkup(createElement(RepostActionIcon, { size: 19 }));
  const mobileReferenceGlyph = renderToStaticMarkup(createElement(ArrowsClockwiseIcon, { size: 19 }));

  assert.deepEqual(pathData(webGlyph), pathData(mobileReferenceGlyph));
});
