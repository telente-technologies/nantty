import { intentFor, plan, type EventMapping } from "./mappingHelpers.js";

export const anniversaryReached: EventMapping = (event, data) => {
  const years = data.integer("years");
  const stats = data.optionalObject("stats");
  const followers = stats?.integer("followers", 0) ?? 0;
  const orders = stats?.integer("orders", 0) ?? 0;
  const label = years === 1 ? "1 year" : `${years} years`;
  return [
    intentFor(event, data.text("accountId"), {
      category: "milestones",
      inApp: { category: "system", title: "Happy Zudoversary!", body: `Thanks for being part of Zudomart for ${label}.` },
      email: (recipient) => plan("zudoversary", {
        firstName: recipient.firstName, years,
        ...(followers > 0 || orders > 0 ? { stats: { ...(followers > 0 ? { followers } : {}), ...(orders > 0 ? { orders } : {}) } } : {}),
      }),
    }),
  ];
};
