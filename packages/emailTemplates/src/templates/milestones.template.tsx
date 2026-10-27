import type { DetailRow } from "../emailTypes";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

const milestonesReason = "You're getting this because Milestones email notifications are on. Turn them off any time in notification settings.";

interface NanttyversaryProps {
  readonly firstName: string;
  readonly years: number;
  readonly stats?: { readonly posts?: number; readonly followers?: number; readonly orders?: number; readonly lives?: number };
}

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  return `${value}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[value % 10] ?? "th"}`;
}

function yearsLabel(years: number): string {
  return years === 1 ? "1 year" : `${years} years`;
}

function statRows(stats: NanttyversaryProps["stats"]): readonly DetailRow[] {
  const rows: DetailRow[] = [];
  const add = (label: string, value: number | undefined) => {
    if (value !== undefined && value > 0) rows.push({ label, value: value.toLocaleString("en"), strong: true });
  };
  add("Posts shared", stats?.posts);
  add("Followers gained", stats?.followers);
  add("Orders completed", stats?.orders);
  add("Lives hosted", stats?.lives);
  return rows;
}

export const nanttyversary = defineEmailTemplate<NanttyversaryProps>({
  key: "nanttyversary", name: "Nanttyversary (account anniversary)", category: "milestones", kind: "transactional", audience: "Any user on their join anniversary",
  trigger: "account.anniversaryReached (daily scheduler, user's timezone)", consent: consentRules.transactionalOptOut,
  subject: (p) => `Happy ${ordinal(p.years)} Nanttyversary, ${p.firstName}`,
  preheader: (p) => `Thanks for being part of Nantty for ${yearsLabel(p.years)}.`,
  reason: () => milestonesReason,
  blocks: (p, c) => {
    const rows = statRows(p.stats);
    return [
      { type: "hero", eyebrow: "Nanttyversary", title: `Happy ${ordinal(p.years)} Nanttyversary!`, tone: "success" },
      { type: "paragraph", text: `Hi ${p.firstName}, thanks for being part of Nantty for ${yearsLabel(p.years)}. We're glad you're here and we're looking forward to what you do next.` },
      ...(rows.length > 0 ? [{ type: "details" as const, title: "Your time on Nantty", rows }] : []),
      { type: "button", label: "Open Nantty", href: c.url("/me") },
    ];
  },
  sample: { firstName: "Ada", years: 2, stats: { posts: 148, followers: 1260, orders: 37, lives: 9 } },
});
