const uuidAtEndPattern = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function slugifyForUrl(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug === "" ? "item" : slug;
}

export function buildProductPath(product: { readonly id: string; readonly name?: string | null; readonly title?: string | null }): string {
  return `/p/${slugifyForUrl(product.name ?? product.title ?? "product")}-${encodeURIComponent(product.id)}`;
}

export function readProductIdFromSlug(slugAndId: string): string | null {
  const decoded = decodeURIComponent(slugAndId);
  const uuid = decoded.match(uuidAtEndPattern)?.[1];
  if (uuid !== undefined) return uuid;
  const lastHyphen = decoded.lastIndexOf("-");
  const productId = lastHyphen === -1 ? decoded : decoded.slice(lastHyphen + 1);
  return /^[A-Za-z0-9_.~]{1,100}$/.test(productId) ? productId : null;
}

export function buildProfilePath(username: string): string {
  return `/${encodeURIComponent(username.replace(/^@/, ""))}`;
}

export function buildStorePath(storeId: string): string {
  return `/store/${encodeURIComponent(storeId)}`;
}

export function buildPostPath(postId: string): string {
  return `/post/${encodeURIComponent(postId)}`;
}

export function buildAbsoluteSiteUrl(path: string): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3500").replace(/\/+$/, "");
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
