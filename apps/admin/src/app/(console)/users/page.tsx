import type { Metadata } from "next";

import { UsersListWorkspace } from "@/components/people/usersListWorkspace";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  const initialSearch = typeof parameters.search === "string" ? parameters.search.slice(0, 80) : "";
  return <UsersListWorkspace initialSearch={initialSearch} />;
}
