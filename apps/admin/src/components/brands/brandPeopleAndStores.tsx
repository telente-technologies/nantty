import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { StatusBadge } from "@/components/ui/statusBadge";
import { UserIdentity } from "@/components/ui/userIdentity";
import type { BrandLinkedStore, BrandMember } from "@/types/brands.type";
import { formatDateOnly, humanizeConstantName } from "@/utils/formatting.util";

const memberColumns: readonly DataTableColumn<BrandMember>[] = [
  { key: "user", header: "Person", render: (member) => <Link href={`/users/${encodeURIComponent(member.user.id)}`}><UserIdentity user={member.user} size={24} /></Link> },
  { key: "role", header: "Brand role", render: (member) => <StatusBadge label={humanizeConstantName(member.role)} tone={member.role === "OWNER" ? "brand" : "neutral"} hasDot={false} />, width: "120px" },
  { key: "added", header: "Added", render: (member) => formatDateOnly(member.addedAt), width: "130px" },
];

const storeColumns: readonly DataTableColumn<BrandLinkedStore>[] = [
  { key: "store", header: "Store", render: (store) => <strong>{store.storeName}</strong> },
  { key: "seller", header: "Seller", render: (store) => <Link href={`/users/${encodeURIComponent(store.seller.id)}`}><UserIdentity user={store.seller} size={24} /></Link> },
  { key: "verified", header: "Gold verified", render: (store) => (store.isVerified ? <StatusBadge label="Verified" tone="success" /> : <StatusBadge label="Not verified" tone="caution" />), width: "130px" },
  { key: "badge", header: "Official badge", render: (store) => (store.hasOfficialBadge ? <StatusBadge label="Official Store" tone="success" hasDot={false} /> : "—"), width: "140px" },
  { key: "linked", header: "Linked", render: (store) => formatDateOnly(store.linkedAt), width: "130px" },
];

export function BrandMembersTable({ members }: { readonly members: readonly BrandMember[] }) {
  return <DataTable caption="Brand members" columns={memberColumns} rows={members} readRowKey={(member) => member.user.id} emptyMessage="No members." />;
}

export function BrandLinkedStoresTable({ stores }: { readonly stores: readonly BrandLinkedStore[] }) {
  return <DataTable caption="Linked stores" columns={storeColumns} rows={stores} readRowKey={(store) => store.id} emptyMessage="No stores are linked to this brand." />;
}
