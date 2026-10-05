export interface LegalVersionFacts {
  readonly id: string;
  readonly documentKey: string;
  readonly versionNumber: number;
  readonly changeSummary: string;
  readonly effectiveAt: string;
  readonly isMaterialChange: boolean;
}

export interface LegalVersionSource {
  findVersion(versionId: string, staffAuthorization: string): Promise<LegalVersionFacts | null>;
}
