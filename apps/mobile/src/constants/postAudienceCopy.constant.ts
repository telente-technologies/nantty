import type { ReplyPolicy, SensitiveLabel } from "@/types/postAudience.type";

export const replyPolicyOptions: readonly { readonly value: ReplyPolicy; readonly label: string; readonly detail: string }[] = [
  { value: "everyone", label: "Everyone", detail: "Anyone signed in can reply" },
  { value: "following", label: "People you follow", detail: "Only accounts you follow can reply" },
  { value: "followers", label: "Followers only", detail: "Only people who follow you can reply" },
  { value: "mentioned", label: "Only people you mention", detail: "Only accounts you @mention can reply" },
  { value: "off", label: "Off", detail: "Comments are turned off" },
];

export const replyPolicyLabel = (policy: ReplyPolicy | undefined) => replyPolicyOptions.find((option) => option.value === (policy ?? "everyone"))?.label ?? "Everyone";

export const sensitiveLabelOptions: readonly { readonly value: SensitiveLabel; readonly label: string; readonly phrase: string; readonly adultsOnly: boolean }[] = [
  { value: "nudity", label: "Nudity or sexual content", phrase: "nudity or sexual content", adultsOnly: true },
  { value: "graphic_violence", label: "Graphic violence", phrase: "graphic violence", adultsOnly: false },
  { value: "dangerous_acts", label: "Dangerous acts", phrase: "dangerous acts", adultsOnly: true },
  { value: "self_harm", label: "Self-harm", phrase: "self-harm", adultsOnly: false },
];
