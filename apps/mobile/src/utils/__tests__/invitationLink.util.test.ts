import { DEFAULT_INVITATION_LINK_EXPIRY_HOURS, invitationLinkExpiryLabel, invitationLinkExpiryOptions, invitationLinkStatus } from "../invitationLink.util";

describe("invitation link UI contract", () => {
  it("offers only the expiry durations accepted by the backend", () => {
    expect(invitationLinkExpiryOptions.map(({ hours }) => hours)).toEqual([24, 168, 720]);
    expect(DEFAULT_INVITATION_LINK_EXPIRY_HOURS).toBe(168);
    expect(invitationLinkExpiryLabel(720)).toBe("30 days");
  });

  it("distinguishes active, expired, revoked, and malformed expiry values", () => {
    const now = Date.parse("2026-11-06T12:00:00.000Z");
    expect(invitationLinkStatus("2026-11-07T12:00:00.000Z", null, now)).toBe("active");
    expect(invitationLinkStatus("2026-11-06T12:00:00.000Z", null, now)).toBe("expired");
    expect(invitationLinkStatus("2026-11-07T12:00:00.000Z", "2026-11-06T11:00:00.000Z", now)).toBe("revoked");
    expect(invitationLinkStatus("not-a-date", null, now)).toBe("unknown");
  });
});
