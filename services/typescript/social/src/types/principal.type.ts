export type ViewerAgeBracket = "adult" | "minor" | "unknown";

export interface Principal {
  readonly accountId: string;
  readonly ageBracket?: ViewerAgeBracket;
}
