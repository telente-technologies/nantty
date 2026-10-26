import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { listEmailTemplateCatalogue, renderEmailSample } from "../src/index";

const outputDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "previews");
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const brand = { appStoreBadgeUrl: "../assets/storeBadges/app-store-badge-black@2x.png", playStoreBadgeUrl: "../assets/storeBadges/google-play-badge@2x.png" };
const catalogue = listEmailTemplateCatalogue();
const rows: string[] = [];
for (const entry of catalogue) {
  const light = await renderEmailSample(entry.key, { theme: "auto", brand });
  const dark = await renderEmailSample(entry.key, { theme: "dark", brand });
  await writeFile(join(outputDirectory, `${entry.key}.html`), light.html);
  await writeFile(join(outputDirectory, `${entry.key}.dark.html`), dark.html);
  await writeFile(join(outputDirectory, `${entry.key}.txt`), `Subject: ${light.subject}\n\n${light.text}`);
  rows.push(`<tr><td>${entry.category}</td><td><a href="${entry.key}.html">${escapeHtml(entry.name)}</a> · <a href="${entry.key}.dark.html">dark</a> · <a href="${entry.key}.txt">text</a></td><td>${entry.kind}</td><td>${escapeHtml(light.subject)}</td></tr>`);
}

const index = `<!doctype html><meta charset="utf-8"><title>Nantty email previews</title><style>body{font:14px system-ui;margin:32px}td{padding:6px 10px;border-bottom:1px solid #ddd}</style><h1>Nantty email previews (${catalogue.length})</h1><table>${rows.join("")}</table>`;
await writeFile(join(outputDirectory, "index.html"), index);
console.log(`Rendered ${catalogue.length} templates (light, dark and text) into ${outputDirectory}`);
