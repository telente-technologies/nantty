import { redirect } from "next/navigation";

export default async function PromoteStorePage({ params }: { readonly params: Promise<{ readonly storeId: string }> }) {
  const { storeId } = await params;
  redirect(`/ads/create?type=store&target=${encodeURIComponent(storeId)}`);
}
