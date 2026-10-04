import { permanentRedirect } from "next/navigation";

import { buildProfilePath } from "@/utils/seoPaths.util";

export default async function LegacyUsernameProfilePage({ params }: { readonly params: Promise<{ readonly username: string }> }) {
  permanentRedirect(buildProfilePath(decodeURIComponent((await params).username)));
}
