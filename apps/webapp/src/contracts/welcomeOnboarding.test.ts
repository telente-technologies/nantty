import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const readAuthSource = (relativePath: string) => readFileSync(resolve(process.cwd(), "src/app/(auth)", relativePath), "utf8");

describe("web welcome screen", () => {
  const welcome = readAuthSource("welcome/page.tsx");
  const socialButtons = readAuthSource("socialSignIn.tsx");

  it("offers Skip in the top bar, going straight to the guest-browsable feed", () => {
    assert.match(welcome, /<Link href="\/" className=\{styles\.skip\}[^>]*>\s*Skip\s*<\/Link>/);
    assert.ok(welcome.indexOf("styles.topBar") < welcome.indexOf("<SocialSignInButtons />"), "Skip sits above the sign-in options");
    assert.doesNotMatch(welcome, /Browse first/);
  });

  it("labels the email option Use email in both modes", () => {
    assert.match(welcome, />\s*Use email\s*</);
    assert.doesNotMatch(welcome, /"Email"/);
  });

  it("gives every sign-in option the same size, width and 24px icon", () => {
    const buttons = [...`${socialButtons}\n${welcome}`.matchAll(/<Button\b([\s\S]*?)>/g)].map((match) => match[1]!);
    assert.equal(buttons.length, 3);
    for (const props of buttons) {
      assert.match(props, /\bfullWidth\b/);
      assert.match(props, /size="lg"/);
      assert.match(props, /size=\{24\}/);
    }
  });
});
