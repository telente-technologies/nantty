export interface ReportTargetResolver {
  resolveOwner(targetType: "live" | "space" | "product" | "store", targetId: string): Promise<string | null>;
}
