import { intentFor, plan, type EventMapping } from "./mappingHelpers.js";

const maximumNoteLength = 500;
const claimUrlPattern = /^(https:\/\/[a-z0-9.-]+|http:\/\/localhost(:\d+)?)\/offer\/[A-Za-z0-9_-]{8,}$/;

export const subscriptionOfferSent: EventMapping = (event, data) => {
  const recipientEmail = data.text("recipientEmail").trim().toLowerCase();
  const claimUrl = data.text("claimUrl");
  if (!claimUrlPattern.test(claimUrl) || !recipientEmail.includes("@")) return [];
  const amountOff = data.optionalMoney("amountOff");
  const expiresAt = data.optionalText("expiresAt");
  const note = data.text("note", "").trim().slice(0, maximumNoteLength);
  return [
    intentFor(event, `offer:${recipientEmail}`, {
      category: "payments",
      variant: data.text("sendId", event.id),
      emailAddressOverride: recipientEmail,
      email: () => plan("subscriptionOfferInvite", {
        planLabels: data.objectList("plans").map((entry) => entry.text("planLabel", "Nantty plan")),
        ...(amountOff === undefined ? { percentOff: data.integer("percentOff") } : { amountOff }),
        durationCycles: Math.max(1, data.integer("durationCycles", 1)),
        ...(expiresAt === undefined || expiresAt === "" ? {} : { expiresAt }),
        ...(note === "" ? {} : { note }),
        claimUrl,
        singleUse: data.bool("singleUse"),
      }),
    }),
  ];
};
