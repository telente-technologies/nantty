import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const targets = process.argv.slice(2);

if (targets.length === 0) {
  console.error("usage: node scripts/stripGeneratedPrismaImports.mjs <generated-dir>...");
  process.exit(1);
}

const processImport = /^import \* as process from 'node:process'\n/m;
const enumsImport = /^import \* as \$Enums from "\.\/enums\.js"\n/m;

async function stripFile(file) {
  const source = await readFile(file, "utf8");
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const withoutReferences = withoutComments.replace(/^export\s.*$/gm, "");
  let next = source;

  if (processImport.test(next) && !/\bprocess\b/.test(withoutReferences.replace(processImport, ""))) {
    next = next.replace(processImport, "");
  }
  if (enumsImport.test(next) && !/\$Enums\b/.test(withoutReferences.replace(enumsImport, ""))) {
    next = next.replace(enumsImport, "");
  }

  if (next !== source) await writeFile(file, next);
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".ts")) await stripFile(fullPath);
  }
}

for (const target of targets) await walk(target);
