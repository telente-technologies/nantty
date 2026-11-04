/** @jsxRuntime automatic @jsxImportSource react */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { BrandLoader } from "../brandLoader";

describe("BrandLoader", () => {
  it("renders the logo mark as a polite status with a hidden label", () => {
    const html = renderToStaticMarkup(<BrandLoader size="lg" />);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /width="64"/);
    assert.match(html, /<span class="visuallyHidden">Loading…<\/span>/);
    const renderedText = html.replace(/<[^>]*>/g, "");
    assert.doesNotMatch(renderedText, /nantty/i);
  });

  it("can show its label", () => {
    assert.match(renderToStaticMarkup(<BrandLoader size="sm" label="Loading posts" showLabel />), /<span class="label">Loading posts<\/span>/);
  });

  it("stops the animation for reduced motion", () => {
    const css = readFileSync(new URL("../brandLoader.module.css", import.meta.url), "utf8");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.match(reduced, /\.mark\s*\{[^}]*animation:\s*none/);
    assert.match(css, /transform:\s*scale\(0\.92\)/);
  });
});
