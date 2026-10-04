import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, plan, type EventMapping, type MappingContext } from "./mappingHelpers.js";

const contentPaths: Readonly<Record<string, string>> = { clip: "clips", post: "posts", sound: "sounds", live: "live" };
const contentNames: Readonly<Record<string, string>> = { clip: "your clip", post: "your post", sound: "your sound", live: "your live video" };

const accountStatusUrl = (context: MappingContext) => `${context.webBaseUrl}/settings/account-status`;
const helpUrl = (context: MappingContext) => `${context.webBaseUrl}/help/safety-and-reporting/copyright-and-account-status`;
const contentUrl = (context: MappingContext, data: EventDataReader) => `${context.webBaseUrl}/${contentPaths[data.text("targetType")] ?? "posts"}/${encodeURIComponent(data.text("targetId"))}`;
const statusLink = (context: MappingContext) => ({ url: accountStatusUrl(context), screen: "AccountStatus" });

const contentProps = (context: MappingContext, data: EventDataReader, firstName: string) => ({
  firstName, claimId: data.text("claimId"), contentLabel: contentNames[data.text("targetType")] ?? "your content", contentUrl: contentUrl(context, data),
  workTitle: data.text("workTitle", "a copyrighted work"), reason: data.text("reason", ""), accountStatusUrl: accountStatusUrl(context), helpUrl: helpUrl(context),
});

export function hoursUntil(deadlineAt: string, from: string): number {
  const difference = Date.parse(deadlineAt) - Date.parse(from);
  return Number.isFinite(difference) ? Math.max(1, Math.round(difference / 3_600_000)) : 48;
}

export const copyrightWarningIssued: EventMapping = (event, data, context) => {
  const hours = hoursUntil(data.text("deadlineAt"), event.occurredAt);
  return [
    intentFor(event, data.text("infringerId"), {
      category: "trust",
      inApp: { category: "system", title: "Copyright warning: action needed", body: `Remove ${contentNames[data.text("targetType")] ?? "the content"} within ${hours} hours to avoid a strike.`, data: { ...statusLink(context), deadlineAt: data.text("deadlineAt") } },
      push: { title: "Copyright warning", body: `Remove the claimed content within ${hours} hours to avoid a strike.`, data: statusLink(context) },
      email: (recipient) => plan("copyrightWarning", { ...contentProps(context, data, recipient.firstName), deadlineAt: data.text("deadlineAt"), deadlineHours: hours }),
    }),
  ];
};

export const copyrightAudioMuted: EventMapping = (event, data, context) => [
  intentFor(event, data.text("infringerId"), {
    category: "trust",
    inApp: { category: "system", title: "Sound muted after a copyright claim", body: "Your video is still up without the claimed audio. You can send a counter-notice.", data: statusLink(context) },
    email: (recipient) => plan("audioMuted", contentProps(context, data, recipient.firstName)),
  }),
];

export const copyrightContentTakenDown: EventMapping = (event, data, context) => {
  if (data.text("infringerId", "") === "") return [];
  const strikeAdded = data.optionalText("strikeId") !== undefined;
  return [
    intentFor(event, data.text("infringerId"), {
      category: "trust",
      inApp: { category: "system", title: "Content taken down for copyright", body: strikeAdded ? "A copyright strike was added to your account." : "It is no longer visible on Zudomart.", data: statusLink(context) },
      push: { title: "Content taken down", body: "Open your account status for details and your options.", data: statusLink(context) },
      email: (recipient) => plan("contentTakenDown", { ...contentProps(context, data, recipient.firstName), strikeAdded }),
    }),
  ];
};

export const strikeIssued: EventMapping = (event, data, context) => {
  if (data.text("kind", "strike") !== "strike") return [];
  const active = data.integer("activeStrikeCount", 1);
  return [
    intentFor(event, data.text("accountId"), {
      category: "trust",
      inApp: { category: "system", title: "A strike was added to your account", body: `You have ${active} active ${active === 1 ? "strike" : "strikes"}.`, data: statusLink(context) },
      email: (recipient) => plan("strikeIssued", { firstName: recipient.firstName, policy: data.text("source", "community") === "copyright" ? "copyright" : data.text("policy", "community"), expiresAt: data.text("expiresAt"), activeStrikeCount: active, threshold: 3, accountStatusUrl: accountStatusUrl(context), helpUrl: helpUrl(context) }),
    }),
  ];
};

export const strikeExpired: EventMapping = (event, data, context) => {
  if (data.text("kind", "strike") !== "strike") return [];
  return [
    intentFor(event, data.text("accountId"), {
      category: "trust",
      inApp: { category: "system", title: "A strike has expired", body: "It no longer counts against your account.", data: statusLink(context) },
      email: (recipient) => plan("strikeExpired", { firstName: recipient.firstName, policy: data.text("source", "community") === "copyright" ? "copyright" : data.text("policy", "community"), activeStrikeCount: data.integer("activeStrikeCount", 0), accountStatusUrl: accountStatusUrl(context) }),
    }),
  ];
};

export const copyrightCounterNoticeReceived: EventMapping = (event, data, context) => {
  const claimant = data.optionalText("claimantUserId");
  if (claimant === undefined) return [];
  const email = data.optionalText("claimantEmail");
  return [
    intentFor(event, claimant, {
      category: "trust",
      inApp: { category: "system", title: "Counter-notice to your copyright claim", body: "The uploader disputes your claim. Content may be restored unless you file court action.", data: { url: helpUrl(context) } },
      email: (recipient) => plan("counterNoticeReceived", { firstName: recipient.firstName, claimId: data.text("claimId"), workTitle: data.text("workTitle", "your work"), restoreEligibleAt: data.text("restoreEligibleAt"), helpUrl: helpUrl(context) }),
      ...(email === undefined ? {} : { emailAddressOverride: email }),
    }),
  ];
};

export const copyrightContentRestored: EventMapping = (event, data, context) => {
  if (data.text("infringerId", "") === "") return [];
  const audioOnly = data.text("remedy", "") === "audio_muted";
  return [
    intentFor(event, data.text("infringerId"), {
      category: "trust",
      inApp: { category: "system", title: audioOnly ? "Your sound is back" : "Your content is restored", body: "Your counter-notice stood after the waiting period.", data: { url: contentUrl(context, data) } },
      email: (recipient) => plan("contentRestored", { ...contentProps(context, data, recipient.firstName), audioOnly }),
    }),
  ];
};
