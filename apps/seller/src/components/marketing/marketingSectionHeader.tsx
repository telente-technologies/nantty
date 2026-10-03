"use client";

import type { ReactNode } from "react";

import { marketingSectionTabs } from "@/components/marketing/marketingPresentation.util";
import { LinkTabs } from "@/components/ui/navigationTabs";
import { PageHeader } from "@/components/ui/panel";

export function MarketingSectionHeader({ title, description, actions }: { readonly title: string; readonly description: string; readonly actions?: ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="Marketing" title={title} description={description} actions={actions} />
      <LinkTabs label="Marketing sections" tabs={marketingSectionTabs} />
    </>
  );
}
