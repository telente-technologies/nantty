import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import type { ProductImportResult } from "@/types/productRequests.type";

export function ProductImportResultPanel({ result }: { readonly result: ProductImportResult }) {
  return (
    <Panel title="Import finished" actions={<ButtonLink href="/products" variant="primary">View products</ButtonLink>}>
      <Callout tone={result.failed.length > 0 ? "caution" : "success"}>
        {result.created} product(s) created, {result.updated} variant(s) updated{result.failed.length > 0 ? `, ${result.failed.length} row(s) failed.` : "."}
      </Callout>
      {result.failed.length > 0 ? (
        <ul style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {result.failed.map((failure) => (
            <li key={`${failure.row}-${failure.message}`}>Row {failure.row}: {failure.message}</li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
