import { randomBytes } from "node:crypto";

export function createSlugFromText(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug === "" ? "item" : slug;
}

export function createUniqueSlugFromText(text: string): string {
  return `${createSlugFromText(text)}-${randomBytes(3).toString("hex")}`;
}
