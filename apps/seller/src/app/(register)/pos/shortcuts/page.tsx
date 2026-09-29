import type { Metadata } from "next";

import { PosShortcutsList } from "@/components/pos/posShortcutsList";
import { ButtonLink } from "@/components/ui/button";
import { Panel, PageHeader } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Register shortcuts" };

export default function RegisterShortcutsPage() {
  return (
    <div style={{ width: "min(720px, 100%)", margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Register shortcuts" description="USB and Bluetooth barcode scanners work anywhere on the register screen: scan and the item is added." actions={<ButtonLink href="/pos" variant="primary">Back to the register</ButtonLink>} />
      <Panel>
        <PosShortcutsList />
      </Panel>
    </div>
  );
}
