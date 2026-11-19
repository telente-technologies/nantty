export interface ChildSafetyScanResult {
  readonly matched: boolean;
  readonly quarantined: boolean;
  readonly provider?: string;
}

export interface ChildSafetyScanner {
  scanMedia(input: { readonly mediaId: string; readonly ownerId: string; readonly sha256Hex: string }): Promise<ChildSafetyScanResult>;
}
