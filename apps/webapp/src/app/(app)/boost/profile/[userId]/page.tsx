import { redirect } from "next/navigation";

export default async function PromoteProfilePage({ params }: { readonly params: Promise<{ readonly userId: string }> }) {
  const { userId } = await params;
  redirect(`/ads/create?type=profile&target=${encodeURIComponent(userId)}`);
}
