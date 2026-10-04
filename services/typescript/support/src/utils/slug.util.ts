export function slugify(text: string, maximumLength = 80): string {
  const slug = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (slug.length > maximumLength ? slug.slice(0, maximumLength).replace(/-[^-]*$/, "") : slug) || "topic";
}

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
