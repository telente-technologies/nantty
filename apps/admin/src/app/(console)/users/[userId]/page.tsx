import type { Metadata } from "next";

import { UserDetailWorkspace } from "@/components/people/userDetailWorkspace";

export const metadata: Metadata = { title: "User" };

export default async function UserDetailPage({ params }: { readonly params: Promise<{ readonly userId: string }> }) {
  const { userId } = await params;
  return <UserDetailWorkspace userId={userId} />;
}
