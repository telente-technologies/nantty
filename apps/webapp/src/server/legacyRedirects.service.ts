import { buildProductPath, buildProfilePath } from "@/utils/seoPaths.util";

import { fetchPublicProduct, fetchPublicProfileById } from "./publicContent.service";

const legacyPathPattern = /^\/(u|user|product)\/([^/]+)$/;

const removedPagePaths: Readonly<Record<string, string>> = { "/rankings": "/me" };

export async function resolveLegacyPublicPathRedirect(pathname: string): Promise<string | null> {
  const removedPageTarget = removedPagePaths[pathname.replace(/\/+$/, "")];
  if (removedPageTarget) return removedPageTarget;
  const match = pathname.match(legacyPathPattern);
  if (!match) return null;
  const [, kind, rawValue = ""] = match;
  let value: string;
  try {
    value = decodeURIComponent(rawValue);
  } catch {
    return null;
  }
  if (kind === "u") return /^@?[A-Za-z0-9._]{1,30}$/.test(value) ? buildProfilePath(value) : null;
  if (kind === "user") {
    const user = await fetchPublicProfileById(value);
    return user ? buildProfilePath(user.username) : null;
  }
  const product = await fetchPublicProduct(value);
  return product ? buildProductPath(product) : null;
}
