import * as WebBrowser from "expo-web-browser";

import { readTokenFromSecurityCheckReturnUrl, runHumanVerificationInAppBrowser } from "../auth/humanVerification.service";

jest.mock("expo-web-browser", () => ({ openAuthSessionAsync: jest.fn() }));

const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;

describe("human verification in the in-app browser", () => {
  beforeEach(() => openAuthSession.mockReset());

  it("only accepts tokens returned to the app's own security-check link", () => {
    expect(readTokenFromSecurityCheckReturnUrl("zudomart://security-check#token=abc.def")).toBe("abc.def");
    expect(readTokenFromSecurityCheckReturnUrl("https://evil.example/security-check#token=abc")).toBeNull();
    expect(readTokenFromSecurityCheckReturnUrl("zudomart://security-check")).toBeNull();
  });

  it("submits the token and shares one check between concurrent requests", async () => {
    openAuthSession.mockResolvedValue({ type: "success", url: "zudomart://security-check#token=XXXX.DUMMY.TOKEN.XXXX" });
    const submitted: string[] = [];
    const submit = async (token: string) => { submitted.push(token); };
    const [first, second] = await Promise.all([runHumanVerificationInAppBrowser("suspected_bot", submit), runHumanVerificationInAppBrowser("suspected_bot", submit)]);
    expect(first && second).toBe(true);
    expect(openAuthSession).toHaveBeenCalledTimes(1);
    expect(submitted).toEqual(["XXXX.DUMMY.TOKEN.XXXX"]);
  });

  it("reports failure when the person closes the sheet or the server rejects the token", async () => {
    openAuthSession.mockResolvedValueOnce({ type: "dismiss" });
    expect(await runHumanVerificationInAppBrowser("security_check", async () => undefined)).toBe(false);
    openAuthSession.mockResolvedValueOnce({ type: "success", url: "zudomart://security-check#token=bad" });
    expect(await runHumanVerificationInAppBrowser("security_check", async () => { throw new Error("400"); })).toBe(false);
  });
});
