import type { ExperimentContent, FeatureFlagContent } from "@/types/featureFlags.type";

const everyPlatform = ["IOS", "ANDROID", "WEB"] as const;

export function buildInitialFeatureFlags(): { id: string; content: FeatureFlagContent; changeReason: string }[] {
  return [
    { id: "live_shopping_multi_guest", changeReason: "Pilot with 20 creators in Lagos and Accra.", content: { description: "Let Creator Program hosts invite up to 3 guests into a live shopping session.", owner: "Live team", isEnabled: true, isKillSwitch: false, rolloutPercent: 25, targeting: { countries: ["NG", "GH"], platforms: ["IOS", "ANDROID"], minimumAppVersion: "3.4.0" } } },
    { id: "coin_gifts_in_clips", changeReason: "Rolled out after fraud review.", content: { description: "Show the gift button on clips, not only on lives.", owner: "Creator monetisation", isEnabled: true, isKillSwitch: false, rolloutPercent: 100, targeting: { countries: [], platforms: [...everyPlatform], minimumAppVersion: "3.2.0" } } },
    { id: "payouts_kill_switch", changeReason: "Created for incident response.", content: { description: "Stop every withdrawal from leaving Zudomart. Only for payment-provider incidents.", owner: "Payments", isEnabled: false, isKillSwitch: true, rolloutPercent: 100, targeting: { countries: [], platforms: [...everyPlatform], minimumAppVersion: null } } },
    { id: "mart_home_personalised_rails", changeReason: "Waiting for ranking model v2.", content: { description: "Personalised product rails on Mart home from the intelligence service.", owner: "Discovery", isEnabled: false, isKillSwitch: false, rolloutPercent: 0, targeting: { countries: ["NG"], platforms: [...everyPlatform], minimumAppVersion: "3.5.0" } } },
    { id: "pidgin_locale", changeReason: "Translation review in progress.", content: { description: "Offer Naija Pidgin as an app language.", owner: "Growth", isEnabled: true, isKillSwitch: false, rolloutPercent: 10, targeting: { countries: ["NG"], platforms: ["ANDROID"], minimumAppVersion: "3.3.0" } } },
  ];
}

export function buildInitialExperiments(): { id: string; content: ExperimentContent; changeReason: string }[] {
  return [
    { id: "checkout_escrow_explainer", changeReason: "Started after design review.", content: { name: "Escrow explainer at checkout", hypothesis: "Explaining escrow protection before payment raises checkout completion.", status: "RUNNING", primaryMetric: "checkout_completion_rate", startedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(), variants: [{ key: "control", description: "Current checkout", weightPercent: 50 }, { key: "inline_explainer", description: "Inline escrow card above Pay", weightPercent: 50 }] } },
    { id: "clip_feed_sound_prompt", changeReason: "Drafted by the clips team.", content: { name: "Sound prompt on first clip", hypothesis: "Prompting to turn sound on raises clip watch time.", status: "DRAFT", primaryMetric: "clip_watch_seconds_per_session", startedAt: null, variants: [{ key: "control", description: "Muted autoplay", weightPercent: 34 }, { key: "toast", description: "Small toast", weightPercent: 33 }, { key: "sheet", description: "Bottom sheet", weightPercent: 33 }] } },
  ];
}
