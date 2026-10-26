import { legalDocumentDefinitions } from "@/constants/legalDocuments.constant";
import type { LegalVersion } from "@/types/legal.type";

import { isoMinutesAgo, isoMinutesFromNow } from "./trustTime.mock";

const dayMinutes = 1440;

export type MutableLegalVersion = { -readonly [Key in keyof LegalVersion]: LegalVersion[Key] };

function buildBody(title: string): string {
  return [
    `# ${title}`,
    "## 1. Who we are\nNantty operates a Nigeria-first social marketplace. Payments and wallets are held by our licensed payment partner in your name, with escrow in Nigeria only. This document explains the rules that apply to you.",
    "## 2. What you agree to\nBy using Nantty you agree to follow this document and the other policies linked from it.",
    "## 3. Your responsibilities\nGive accurate information, keep your login safe and follow the law where you live.",
    "## 4. Changes to this document\nWe tell you by email when a change matters. For material changes you get at least 30 days before they apply.",
    "## 5. Contact\nWrite to legal@nantty.com for questions about this document.",
  ].join("\n\n");
}

type VersionOverrides = Partial<MutableLegalVersion> & Pick<MutableLegalVersion, "documentKey" | "versionNumber" | "status">;

function buildVersion(overrides: VersionOverrides, title: string): MutableLegalVersion {
  return {
    id: `lgv_${overrides.documentKey}_${overrides.versionNumber}`,
    bodyMarkdown: buildBody(title),
    changeSummary: "First version, not yet in effect.",
    effectiveAt: isoMinutesFromNow(45 * dayMinutes),
    isMaterialChange: false,
    isFlaggedForLegalReview: false,
    createdByName: "Funmi Balogun",
    createdAt: isoMinutesAgo(5 * dayMinutes),
    submittedByName: "Funmi Balogun",
    submittedAt: isoMinutesAgo(4 * dayMinutes),
    publishedByName: "Segun Adebisi",
    publishedAt: isoMinutesAgo(2 * dayMinutes),
    returnedReason: null,
    rolledBackFromVersionNumber: null,
    noticeId: null,
    ...overrides,
  };
}

export function buildDemoLegalVersions(): MutableLegalVersion[] {
  return legalDocumentDefinitions.map(({ key, title }) => buildVersion({ documentKey: key, versionNumber: 1, status: "PUBLISHED", isMaterialChange: true }, title));
}
