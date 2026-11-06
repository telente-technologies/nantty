import { spaceInvitationRoleLabel } from "../spaceInvitation.util";

describe("spaceInvitationRoleLabel", () => {
  it.each([
    ["moderator", "Co-host"],
    ["cohost", "Co-host"],
    ["speaker", "Speaker"],
    ["listener", "Listener"],
  ] as const)("maps %s to %s", (role, label) => {
    expect(spaceInvitationRoleLabel(role)).toBe(label);
  });
});
