import { intentFor, plan, type EventMapping } from "./mappingHelpers.js";

export const adInviteCreated: EventMapping = (event, data) => {
  const accountName = data.text("accountName", "an ad account");
  const invitedBy = data.text("invitedBy", "Someone");
  const inviteUrl = data.text("inviteUrl");
  if (!/^https:\/\//.test(inviteUrl) && !/^http:\/\/localhost[:/]/.test(inviteUrl)) return [];
  return [
    intentFor(event, data.text("inviteeUserId"), {
      category: "seller",
      inApp: { category: "system", title: "Ad account invite", body: `${invitedBy} invited you to ${accountName} on Zudomart Ads.`, data: { url: inviteUrl, screen: "AdAccountInvite", inviteId: data.text("inviteId", "") } },
      email: (recipient) => plan("adAccountInvite", { firstName: recipient.firstName, accountName, role: data.text("role", "advertiser"), invitedBy, inviteUrl, expiresAt: data.text("expiresAt", event.occurredAt) }),
    }),
  ];
};
