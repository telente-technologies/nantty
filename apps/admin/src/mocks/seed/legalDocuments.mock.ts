import { legalDocumentDefinitions } from "@/constants/legalDocuments.constant";
import type { LegalVersion } from "@/types/legal.type";

import { isoMinutesAgo, isoMinutesFromNow } from "./trustTime.mock";

const dayMinutes = 1440;

export type MutableLegalVersion = { -readonly [Key in keyof LegalVersion]: LegalVersion[Key] };

function buildBody(title: string, revision: number): string {
  const sections = [
    `# ${title}`,
    "## 1. Who we are\nZudomart operates a Nigeria-first social marketplace. Payments and wallets are held by our licensed payment partner in your name, with escrow in Nigeria only. This document explains the rules that apply to you.",
    "## 2. What you agree to\nBy using Zudomart you agree to follow this document and the other policies linked from it.",
    "## 3. Your responsibilities\nGive accurate information, keep your login safe and follow the law where you live.",
  ];
  if (revision >= 2) sections.push("## 4. Changes to this document\nWe tell you by email when a change matters. For material changes you get at least 30 days before they apply.");
  if (revision >= 3) sections.push("## 5. Contact\nWrite to legal@zudomart.com for questions about this document.");
  return sections.join("\n\n");
}

type VersionOverrides = Partial<MutableLegalVersion> & Pick<MutableLegalVersion, "documentKey" | "versionNumber" | "status">;

function buildVersion(overrides: VersionOverrides, title: string): MutableLegalVersion {
  return {
    id: `lgv_${overrides.documentKey}_${overrides.versionNumber}`,
    bodyMarkdown: buildBody(title, overrides.versionNumber),
    changeSummary: "Initial version.",
    effectiveAt: isoMinutesAgo(180 * dayMinutes),
    isMaterialChange: false,
    isFlaggedForLegalReview: false,
    createdByName: "Funmi Balogun",
    createdAt: isoMinutesAgo(185 * dayMinutes),
    submittedByName: "Funmi Balogun",
    submittedAt: isoMinutesAgo(184 * dayMinutes),
    publishedByName: "Segun Adebisi",
    publishedAt: isoMinutesAgo(181 * dayMinutes),
    returnedReason: null,
    rolledBackFromVersionNumber: null,
    noticeId: null,
    ...overrides,
  };
}

export function buildDemoLegalVersions(): MutableLegalVersion[] {
  const versions: MutableLegalVersion[] = [];
  for (const definition of legalDocumentDefinitions) {
    const { key, title } = definition;
    const hasSecondRevision = key === "terms" || key === "privacy";
    versions.push(buildVersion({ documentKey: key, versionNumber: 1, status: hasSecondRevision ? "SUPERSEDED" : "PUBLISHED" }, title));
    if (!hasSecondRevision) continue;
    versions.push(buildVersion({ documentKey: key, versionNumber: 2, status: "PUBLISHED", changeSummary: "Explained how we notify you about changes and added the 30-day notice for material changes.", effectiveAt: isoMinutesAgo(10 * dayMinutes), isMaterialChange: true, isFlaggedForLegalReview: true, createdAt: isoMinutesAgo(50 * dayMinutes), submittedAt: isoMinutesAgo(48 * dayMinutes), publishedAt: isoMinutesAgo(40 * dayMinutes), noticeId: `lgn_${key}_2` }, title));
  }
  versions.push(buildVersion({ documentKey: "terms", versionNumber: 3, status: "IN_REVIEW", changeSummary: "Added a contact address and clarified the username rules.", effectiveAt: isoMinutesFromNow(30 * dayMinutes), isMaterialChange: true, isFlaggedForLegalReview: true, createdAt: isoMinutesAgo(3 * dayMinutes), submittedAt: isoMinutesAgo(dayMinutes), publishedByName: null, publishedAt: null }, "Terms of Service"));
  versions.push(buildVersion({ documentKey: "privacy", versionNumber: 3, status: "DRAFT", changeSummary: "Fixed typos in the data retention section.", effectiveAt: isoMinutesFromNow(dayMinutes), createdByName: "Segun Adebisi", createdAt: isoMinutesAgo(dayMinutes / 2), submittedByName: null, submittedAt: null, publishedByName: null, publishedAt: null }, "Privacy Policy"));
  return versions;
}
