import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ProfileByUsernameView } from "@/components/profile/profileByUsernameView";
import { isReservedTopLevelRoute } from "@/config/reservedRoutes.config";
import { fetchPublicProfileByUsername } from "@/server/publicContent.service";
import { buildAbsoluteSiteUrl, buildProfilePath } from "@/utils/seoPaths.util";
import { buildBreadcrumbJsonLd, buildProfilePageJsonLd, serializeJsonLdForScriptTag } from "@/utils/structuredData.util";

interface ProfilePageProps {
  readonly params: Promise<{ readonly username: string }>;
}

async function loadProfile(rawUsername: string) {
  const username = decodeURIComponent(rawUsername).replace(/^@/, "");
  if (isReservedTopLevelRoute(username)) return { username, user: null };
  return { username, user: await fetchPublicProfileByUsername(username) };
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { user } = await loadProfile((await params).username);
  if (!user) return { title: "Profile not found", robots: { index: false } };
  const canonicalUrl = buildAbsoluteSiteUrl(buildProfilePath(user.username));
  const displayName = user.name || user.username;
  const description = (user.bio || `See posts, clips and lives from ${displayName} on Nantty.`).replace(/\s+/g, " ").slice(0, 160);
  return {
    title: `${displayName} (@${user.username})`,
    description,
    alternates: { canonical: canonicalUrl, languages: { "en-NG": canonicalUrl, "x-default": canonicalUrl } },
    openGraph: { type: "profile", url: canonicalUrl, siteName: "Nantty", title: `${displayName} (@${user.username})`, description, username: user.username, images: user.avatarUrl ? [{ url: user.avatarUrl, alt: displayName }] : [] },
    twitter: { card: "summary", title: `${displayName} (@${user.username})`, description, images: user.avatarUrl ? [user.avatarUrl] : [] },
  };
}

export default async function ProfileByUsernamePage({ params }: ProfilePageProps) {
  const raw = (await params).username;
  const { username, user } = await loadProfile(raw);
  if (!user) notFound();
  if (raw !== user.username && username !== user.username) permanentRedirect(buildProfilePath(user.username));
  const structuredData = [buildProfilePageJsonLd(user), buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: `@${user.username}`, path: buildProfilePath(user.username) }])];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLdForScriptTag(structuredData) }} />
      <ProfileByUsernameView initialUser={user} />
    </>
  );
}
