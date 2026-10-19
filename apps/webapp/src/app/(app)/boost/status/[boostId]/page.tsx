import { redirect } from "next/navigation";

export default async function BoostStatusPage({ params }: { readonly params: Promise<{ readonly boostId: string }> }) {
  const { boostId } = await params;
  redirect(`/ads/${encodeURIComponent(boostId)}`);
}
