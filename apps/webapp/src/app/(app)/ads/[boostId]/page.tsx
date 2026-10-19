import { AdDetail } from "@/components/ads/adDetail";

export default async function AdDetailPage({ params }: { readonly params: Promise<{ readonly boostId: string }> }) {
  const { boostId } = await params;
  return <AdDetail boostId={boostId} />;
}
