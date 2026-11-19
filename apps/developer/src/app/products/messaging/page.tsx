import { BusinessMessagingDocs } from "@/components/businessMessagingDocs";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata = { title: "Business Messaging API" };

export default function PublicMessagingProductPage() {
  return (
    <PublicDocsShell>
      <BusinessMessagingDocs />
    </PublicDocsShell>
  );
}
