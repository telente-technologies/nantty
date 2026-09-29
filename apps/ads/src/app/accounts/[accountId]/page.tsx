import { redirect } from "next/navigation";

export default async function AccountIndexPage({ params }: { readonly params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  redirect(`/accounts/${accountId}/overview`);
}
