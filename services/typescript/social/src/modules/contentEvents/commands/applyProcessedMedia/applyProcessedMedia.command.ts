export interface ProcessedMediaVariant {
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly key: string;
}

export interface ApplyProcessedMediaCommand {
  readonly mediaId: string;
  readonly outcome: "ready" | "failed";
  readonly kind: string | undefined;
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly durationSeconds: number | undefined;
  readonly posterKey: string | undefined;
  readonly hlsKey: string | undefined;
  readonly variants: readonly ProcessedMediaVariant[];
  readonly occurredAt: Date;
}
