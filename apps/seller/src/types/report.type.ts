import type { Money } from "@/types/money.type";
import type { reportKinds } from "@/constants/reportCatalog.constant";

export type ReportKind = (typeof reportKinds)[number];
export type ReportColumnKind = "text" | "money" | "number" | "percent" | "date";
export type ReportCellValue = string | number | Money | null;

export interface ReportColumn {
  readonly key: string;
  readonly label: string;
  readonly kind: ReportColumnKind;
}

export interface ReportResult {
  readonly reportKind: ReportKind;
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly columns: ReportColumn[];
  readonly rows: Record<string, ReportCellValue>[];
  readonly totals: Record<string, ReportCellValue> | null;
  readonly generatedAt: string;
}
