import { assessLinkRisk, isWebUrl } from "@/components/chat/chatLinks.util";

describe("in-app browser link schemes", () => {
  it("only treats http and https as web links", () => {
    expect(isWebUrl("https://example.com/a")).toBe(true);
    expect(isWebUrl("http://example.com")).toBe(true);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
    expect(isWebUrl("intent://scan/#Intent;scheme=zxing;end")).toBe(false);
    expect(isWebUrl("file:///etc/passwd")).toBe(false);
  });

  it("never rates a non-web scheme as safe", () => {
    expect(assessLinkRisk("intent://example.com/#Intent;end")).toBe("suspicious");
    expect(assessLinkRisk("https://example.com")).toBe("safe");
  });
});
