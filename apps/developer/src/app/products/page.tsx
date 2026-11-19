import { DeveloperProductsWorkspace } from "@/components/developerCatalogAndOps";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata = { title: "API Products" };

export default function PublicProductsPage() {
  return (
    <PublicDocsShell>
      <DeveloperProductsWorkspace />
    </PublicDocsShell>
  );
}
