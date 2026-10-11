export function isSameSiteHelpHref(href: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(href);
}
