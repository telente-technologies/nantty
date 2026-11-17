import type { MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import type { VerificationColor, VerificationStatus, VerificationTier } from "@/types/platformUser.type";
import type { VerificationApplicantDetails, VerificationAutomatedCheck, VerificationDocumentKind, VerificationDocumentSummary } from "@/types/verification.type";

export interface MockVerificationRecord {
  id: string;
  userId: string;
  color: VerificationColor;
  tier: VerificationTier;
  status: VerificationStatus;
  subjectKind: "PERSON" | "BUSINESS" | "GOVERNMENT";
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  decisionReason: string | null;
  applicant: VerificationApplicantDetails;
  documents: VerificationDocumentSummary[];
  checks: VerificationAutomatedCheck[];
}

const majorMonthlyPriceByCurrency: Record<string, Record<string, number>> = {
  BLUE_ESSENTIAL: { NGN: 1_000, GHS: 12, KES: 200, ZAR: 29.99, GBP: 2.49, EUR: 2.49, USD: 2.49 },
  BLUE_VERIFIED: { NGN: 2_500, GHS: 30, KES: 500, ZAR: 59.99, GBP: 5.99, EUR: 5.99, USD: 5.99 },
  BLUE_PREMIUM: { NGN: 20_000, GHS: 55, KES: 900, ZAR: 109.99, GBP: 9.99, EUR: 10.99, USD: 9.99 },
  GOLD_ONLY: { NGN: 3_000, GHS: 36, KES: 600, ZAR: 89.99, GBP: 9, EUR: 10, USD: 10 },
  GOLD_PRO: { NGN: 5_000, GHS: 60, KES: 1_000, ZAR: 149.99, GBP: 15, EUR: 17, USD: 17 },
  GOLD_BUSINESS: { NGN: 30_000, GHS: 180, KES: 3_000, ZAR: 449.99, GBP: 45, EUR: 49, USD: 49 },
};

export function readDemoVerificationPlanPrice(color: VerificationColor, tier: VerificationTier, currency: string): { planCode: string; price: { amountMinor: number; currency: string } } | null {
  const planCode = `${color}_${tier}`;
  const majorAmount = majorMonthlyPriceByCurrency[planCode]?.[currency];
  if (majorAmount === undefined) return null;
  return { planCode: `${planCode}_MONTHLY`, price: { amountMinor: Math.round(majorAmount * 100), currency } };
}

const documentLabels: Record<VerificationDocumentKind, string> = {
  NATIONAL_ID: "National ID (NIN slip)",
  PASSPORT: "International passport",
  DRIVERS_LICENCE: "Driver's licence",
  SELFIE: "Liveness selfie",
  CAC_CERTIFICATE: "CAC certificate of registration",
  UTILITY_BILL: "Utility bill (proof of address)",
  GOVERNMENT_LETTER: "Official letter on agency letterhead",
};

interface SeedRow {
  readonly username: string;
  readonly color: VerificationColor;
  readonly tier: VerificationTier;
  readonly status: VerificationStatus;
  readonly daysAgo: number;
  readonly business?: { name: string; registration: string };
  readonly agency?: { name: string; contact: string };
  readonly category: string;
  readonly failingCheck?: string;
}

const seedRows: readonly SeedRow[] = [
  { username: "chioma_threads", color: "GOLD", tier: "PRO", status: "PENDING", daysAgo: 2, business: { name: "Chioma Threads Enterprises", registration: "BN 3378215" }, category: "Fashion & tailoring" },
  { username: "halima.hijabs", color: "GOLD", tier: "PRO", status: "PENDING", daysAgo: 1, business: { name: "Halima Modest Wear Ltd", registration: "RC 1893044" }, category: "Modest fashion", failingCheck: "Business address on CAC does not match utility bill" },
  { username: "amara.reads", color: "BLUE", tier: "VERIFIED", status: "PENDING", daysAgo: 3, category: "Books & education creator" },
  { username: "jide.kicks", color: "BLUE", tier: "ESSENTIAL", status: "PENDING", daysAgo: 0.4, category: "Sneaker reseller" },
  { username: "ken.otieno", color: "BLACK", tier: "OFFICIAL", status: "PENDING", daysAgo: 5, agency: { name: "Kenya Film Commission", contact: "kenya.film.commission@example.com" }, category: "Government agency" },
  { username: "adaeze.styles", color: "GOLD", tier: "PRO", status: "VERIFIED", daysAgo: 400, business: { name: "Adaeze Styles Ltd", registration: "RC 1654420" }, category: "Fashion" },
  { username: "kemi.kitchen", color: "GOLD", tier: "BUSINESS", status: "VERIFIED", daysAgo: 300, business: { name: "Kemi's Kitchen Foods", registration: "BN 2987711" }, category: "Food" },
  { username: "funke.naturals", color: "GOLD", tier: "PRO", status: "VERIFIED", daysAgo: 250, business: { name: "Funke Naturals Cosmetics", registration: "RC 1720093" }, category: "Beauty" },
  { username: "lagosstate.gov", color: "BLACK", tier: "OFFICIAL", status: "VERIFIED", daysAgo: 600, agency: { name: "Lagos State Government", contact: "lagos.state.digital@example.com" }, category: "State government" },
  { username: "tunde_eats", color: "BLUE", tier: "PREMIUM", status: "VERIFIED", daysAgo: 320, category: "Food creator" },
  { username: "zainab.glow", color: "BLUE", tier: "VERIFIED", status: "VERIFIED", daysAgo: 280, category: "Beauty creator" },
  { username: "kwame.beats", color: "BLUE", tier: "VERIFIED", status: "VERIFIED", daysAgo: 190, category: "Music producer" },
  { username: "obinna.tech", color: "BLUE", tier: "PREMIUM", status: "VERIFIED", daysAgo: 350, category: "Tech reviewer" },
  { username: "yemi.sound", color: "BLUE", tier: "VERIFIED", status: "VERIFIED", daysAgo: 500, category: "Musician" },
  { username: "sipho.fits", color: "BLUE", tier: "ESSENTIAL", status: "VERIFIED", daysAgo: 60, category: "Fitness" },
  { username: "mide.mua", color: "BLUE", tier: "ESSENTIAL", status: "VERIFIED", daysAgo: 90, category: "Makeup artist" },
  { username: "tomi.travels", color: "BLUE", tier: "VERIFIED", status: "SUSPENDED", daysAgo: 200, category: "Travel creator" },
];

function buildDocumentsForRow(row: SeedRow, id: string, submittedAt: string): VerificationDocumentSummary[] {
  const kinds: VerificationDocumentKind[] = row.color === "GOLD" ? ["CAC_CERTIFICATE", "NATIONAL_ID", "UTILITY_BILL"] : row.color === "BLACK" ? ["GOVERNMENT_LETTER", "NATIONAL_ID"] : ["NATIONAL_ID", "SELFIE"];
  return kinds.map((kind, index) => ({ id: `${id}_doc_${index + 1}`, kind, label: documentLabels[kind], uploadedAt: submittedAt }));
}

function buildChecksForRow(row: SeedRow): VerificationAutomatedCheck[] {
  const checks: VerificationAutomatedCheck[] = [
    { label: "NIN matches legal name", result: "PASS", detail: "NIMC lookup matched name and date of birth." },
    { label: "Liveness selfie", result: row.color === "BLACK" ? "REVIEW" : "PASS", detail: row.color === "BLACK" ? "Officer selfie not required; confirm by official email." : "Face match score 0.97." },
  ];
  if (row.business) checks.push({ label: "CAC registry lookup", result: "PASS", detail: `${row.business.registration} is active and names the applicant as proprietor/director.` });
  if (row.agency) checks.push({ label: "Official domain", result: "REVIEW", detail: `Confirmation email sent to ${row.agency.contact}; awaiting reply.` });
  if (row.failingCheck) checks.push({ label: "Address consistency", result: "FAIL", detail: row.failingCheck });
  checks.push({ label: "Sanctions & PEP screening", result: "PASS", detail: "No matches on UN, OFAC or EFCC lists." });
  return checks;
}

export function buildDemoVerifications(users: readonly MockPlatformUserRecord[]): MockVerificationRecord[] {
  const records: MockVerificationRecord[] = [];
  seedRows.forEach((row, index) => {
    const user = users.find((candidate) => candidate.username === row.username);
    if (!user) return;
    const id = `ver_${String(index + 1).padStart(4, "0")}`;
    const submittedAt = new Date(Date.now() - row.daysAgo * 86_400_000).toISOString();
    const isReviewed = row.status !== "PENDING";
    records.push({
      id,
      userId: user.id,
      color: row.color,
      tier: row.tier,
      status: row.status,
      subjectKind: row.color === "GOLD" ? "BUSINESS" : row.color === "BLACK" ? "GOVERNMENT" : "PERSON",
      submittedAt,
      reviewedAt: isReviewed ? new Date(Date.parse(submittedAt) + 86_400_000).toISOString() : null,
      reviewedByName: isReviewed ? "Chidi Okafor" : null,
      decisionReason: row.status === "SUSPENDED" ? "Sold verified status in DMs; suspended pending investigation." : isReviewed ? "Documents verified." : null,
      applicant: {
        legalName: user.personalData.legalName,
        category: row.category,
        country: user.country,
        businessName: row.business?.name ?? null,
        registrationNumber: row.business?.registration ?? null,
        agencyName: row.agency?.name ?? null,
        officialContactEmail: row.agency?.contact ?? null,
      },
      documents: buildDocumentsForRow(row, id, submittedAt),
      checks: buildChecksForRow(row),
    });
  });
  return records;
}
