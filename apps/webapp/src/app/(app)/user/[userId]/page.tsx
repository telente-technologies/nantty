import { notFound, permanentRedirect } from "next/navigation";

import { fetchPublicProfileById } from "@/server/publicContent.service";
import { buildProfilePath } from "@/utils/seoPaths.util";

export default async function LegacyUserIdProfilePage({ params }: { readonly params: Promise<{ readonly userId: string }> }) {
  const user = await fetchPublicProfileById(decodeURIComponent((await params).userId));
  if (!user) notFound();
  permanentRedirect(buildProfilePath(user.username));
}
