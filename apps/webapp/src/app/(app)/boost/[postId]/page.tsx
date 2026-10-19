import { redirect } from "next/navigation";

export default async function PromotePostPage({ params }: { readonly params: Promise<{ readonly postId: string }> }) {
  const { postId } = await params;
  redirect(`/ads/create?type=post&target=${encodeURIComponent(postId)}`);
}
