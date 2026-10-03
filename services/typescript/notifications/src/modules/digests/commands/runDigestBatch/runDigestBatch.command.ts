import type { DigestKind } from "../../../../interfaces/digestSource.interface.js";

export interface RunDigestBatchCommand {
  readonly kind: DigestKind;
  readonly periodKey: string;
  readonly cursor: string | null;
}
