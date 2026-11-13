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

  it("keeps Nantty-styled Apple and mock Google options consistent and renders the verified Google button when configured", () => {
    const buttons = [...socialButtons.matchAll(/<Button\b([\s\S]*?)>/g)].map((match) => match[1]!).filter((props) => props.includes("leadingIcon="));
    assert.equal(buttons.length, 2);
    for (const props of buttons) {
      assert.match(props, /\bfullWidth\b/);
      assert.match(props, /size="lg"/);
      assert.match(props, /size=\{24\}/);
    }
    assert.match(socialButtons, /googleIdentity\.renderButton/);
    assert.match(socialButtons, /client_id: googleClientId/);
  });

  it("reuses the provider identity and nonce when the birthday challenge is submitted", () => {
    assert.match(socialButtons, /setBirthdayChallenge\(\{ provider, identity \}\)/);
    assert.match(socialButtons, /completeSocialSignIn\(birthdayChallenge\.provider, birthdayChallenge\.identity, birthday\)/);
    assert.match(socialButtons, /readNonceFromIdentityToken\(idToken\) !== nonce/);
  });

  it("replaces provider choices with an accessible birthday challenge and lets the user cancel it", () => {
    assert.match(socialButtons, /role="heading" aria-level=\{3\}/);
    assert.match(socialButtons, /\{!birthdayChallenge \? <>[\s\S]*Continue with Apple[\s\S]*Continue with Google[\s\S]*<\/> : null\}/);
    assert.match(socialButtons, /const handleBirthdayCancel = \(\) => \{\s*setBirthdayChallenge\(null\);\s*setBirthday\(""\);\s*setNotice\(null\);/);
    assert.match(socialButtons, /<Button variant="secondary" fullWidth size="lg" disabled=\{signingInWith !== null\} onClick=\{handleBirthdayCancel\}>\s*Cancel/);
  });
});
