import { decideSensitiveInterstitialState, describeSensitiveLabels } from "../sensitiveContent.util";

describe("sensitive content interstitial", () => {
  it("covers labelled posts until the viewer consents", () => {
    const sensitive = { labels: ["graphic_violence"] as const, requiresInterstitial: true };
    expect(decideSensitiveInterstitialState(sensitive, false)).toBe("covered");
    expect(decideSensitiveInterstitialState(sensitive, true)).toBe("revealed");
  });

  it("shows unlabelled posts and posts the viewer chose to see without warnings", () => {
    expect(decideSensitiveInterstitialState(null, false)).toBe("none");
    expect(decideSensitiveInterstitialState({ labels: ["self_harm"], requiresInterstitial: false }, false)).toBe("none");
  });

  it("names what the post may contain", () => {
    expect(describeSensitiveLabels(["nudity"])).toBe("This post may contain nudity or sexual content.");
    expect(describeSensitiveLabels(["graphic_violence", "self_harm", "dangerous_acts"])).toBe("This post may contain graphic violence, dangerous acts and self-harm.");
  });
});
