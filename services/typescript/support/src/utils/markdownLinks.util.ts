const linkTargetPattern = /\]\(([^)]*)\)/g;
const sameSitePathPattern = /^\/(?![/\\])[^\s\\]*$/;

export function neutraliseOffsiteMarkdownLinks(markdown: string): string {
  return markdown.replace(linkTargetPattern, (match: string, href: string) => (sameSitePathPattern.test(href.trim()) ? match : "]"));
}
