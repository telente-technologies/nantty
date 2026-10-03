import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromApp = createRequire(join(appDirectory, "package.json"));
const requireFromCore = createRequire(createRequire(requireFromApp.resolve("babel-preset-expo")).resolve("@babel/core"));
const { parse } = requireFromCore("@babel/parser");
const traverse = requireFromCore("@babel/traverse").default;

const DARK_FIRST = ["src/components/live", "src/screens/live", "src/components/clips", "src/screens/clips", "src/components/story", "src/screens/story"];
const NOT_UI = ["src/components/icons", "src/theme", "src/constants", "src/mocks"];
const HEX_OR_RGB = /^(#[0-9A-Fa-f]{3,8}|rgba?\(.*\))$/;

const listSourceFiles = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name);
    if (statSync(fullPath).isDirectory()) return listSourceFiles(fullPath);
    return /\.tsx$/.test(name) ? [fullPath] : [];
  });

const totals = { uiFiles: 0, themedFiles: 0, staticColorReferences: 0, staticColorReferencesInStyleSheets: 0, filesWithStaticStyleSheetColors: 0, rawColorLiteralsInStyleSheets: 0, darkFirstFiles: 0 };
const offenders = [];

for (const filePath of listSourceFiles(join(appDirectory, "src"))) {
  const relativePath = relative(appDirectory, filePath);
  if (NOT_UI.some((prefix) => relativePath.startsWith(prefix))) continue;
  const source = readFileSync(filePath, "utf8");
  if (!source.includes("StyleSheet") && !source.includes("colors")) continue;
  if (DARK_FIRST.some((prefix) => relativePath.startsWith(prefix))) {
    totals.darkFirstFiles += 1;
    continue;
  }
  totals.uiFiles += 1;
  if (source.includes('from "@/theme"')) totals.themedFiles += 1;
  const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
  const styleSheetRanges = [];
  let staticReferences = [];
  let rawLiterals = 0;
  traverse(ast, {
    Program(programPath) {
      const binding = programPath.scope.getBinding("colors");
      if (binding?.kind === "module" && binding.path.parentPath.node.source.value === "@/constants/colors.constant") staticReferences = binding.referencePaths;
    },
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (callee.type === "MemberExpression" && callee.object.name === "StyleSheet" && callee.property.name === "create") styleSheetRanges.push([callPath.node.start, callPath.node.end]);
    },
    StringLiteral(literalPath) {
      if (!HEX_OR_RGB.test(literalPath.node.value)) return;
      const property = literalPath.parentPath;
      if (property.isObjectProperty() && /shadowColor|textShadowColor/.test(property.node.key.name ?? "")) return;
      if (literalPath.findParent((parent) => parent.isCallExpression() && parent.node.callee.property?.name === "create")) rawLiterals += 1;
    },
  });
  const inStyleSheets = staticReferences.filter((reference) => styleSheetRanges.some(([start, end]) => reference.node.start >= start && reference.node.end <= end)).length;
  totals.staticColorReferences += staticReferences.length;
  totals.staticColorReferencesInStyleSheets += inStyleSheets;
  totals.rawColorLiteralsInStyleSheets += rawLiterals;
  if (inStyleSheets > 0) totals.filesWithStaticStyleSheetColors += 1;
  if (staticReferences.length > 0 || rawLiterals > 0) offenders.push(`${relativePath} static=${staticReferences.length} inStyleSheet=${inStyleSheets} rawLiterals=${rawLiterals}`);
}

console.log(JSON.stringify(totals, null, 2));
if (process.argv.includes("--list")) console.log(offenders.join("\n"));
