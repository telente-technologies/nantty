import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportDetailView } from "@/components/reports/reportDetailView";
import { findReportCatalogEntry } from "@/constants/reportCatalog.constant";

interface ReportPageProps {
  readonly params: Promise<{ readonly reportKind: string }>;
}

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const { reportKind } = await params;
  return { title: findReportCatalogEntry(reportKind)?.title ?? "Report" };
}

export default async function ReportDetailPage({ params }: ReportPageProps) {
  const { reportKind } = await params;
  const catalogEntry = findReportCatalogEntry(reportKind);
  if (!catalogEntry) notFound();
  return <ReportDetailView catalogEntry={catalogEntry} />;
}
