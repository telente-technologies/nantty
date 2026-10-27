import { intentFor, plan, type EventMapping } from "./mappingHelpers.js";

const STAT_KEYS = ["posts", "followers", "orders", "lives"] as const;

export const anniversaryReached: EventMapping = (event, data) => {
  const years = data.integer("years");
  const reader = data.optionalObject("stats");
  const stats: Partial<Record<(typeof STAT_KEYS)[number], number>> = {};
  for (const key of STAT_KEYS) {
    const value = reader?.integer(key, 0) ?? 0;
    if (value > 0) stats[key] = value;
  }
  const label = years === 1 ? "1 year" : `${years} years`;
  return [
    intentFor(event, data.text("accountId"), {
      category: "milestones",
      inApp: { category: "system", title: "Happy Nantty anniversary!", body: `Thanks for being part of Nantty for ${label}.` },
      email: (recipient) => plan("zudoversary", { firstName: recipient.firstName, years, ...(Object.keys(stats).length > 0 ? { stats } : {}) }),
    }),
  ];
};
