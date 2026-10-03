import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromApp = createRequire(join(appDirectory, "package.json"));
const requireFromBabelCore = createRequire(requireFromApp.resolve("babel-preset-expo"));
const requireFromCore = createRequire(requireFromBabelCore.resolve("@babel/core"));
const { parse } = requireFromCore("@babel/parser");
const traverse = requireFromCore("@babel/traverse").default;

const COLORS_MODULE = "@/constants/colors.constant";
const DARK_FIRST_DIRECTORIES = ["src/components/live", "src/screens/live", "src/components/clips", "src/screens/clips", "src/components/story", "src/screens/story", "src/components/icons", "src/theme", "src/constants", "src/mocks"];
const SEMANTIC_RENAMES_BY_CONTEXT = {
  backgroundColor: { white: "surface", primary: "primarySolid" },
  borderColor: { white: "surface" },
  borderTopColor: { white: "surface" },
  borderBottomColor: { white: "surface" },
  color: { black: "text" },
  placeholderTextColor: { placeholder: "inputPlaceholderText" },
  background: { white: "surface" },
};

const isDryRun = process.argv.includes("--dry-run");
const onlyPaths = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));

const listSourceFiles = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name);
    if (statSync(fullPath).isDirectory()) return listSourceFiles(fullPath);
    return /\.tsx?$/.test(name) ? [fullPath] : [];
  });

const isDarkFirst = (filePath) => DARK_FIRST_DIRECTORIES.some((directory) => relative(appDirectory, filePath).startsWith(directory));
const isComponentOrHookName = (name) => !!name && (/^[A-Z]/.test(name) || /^use[A-Z]/.test(name));
const hookNameForStyles = (name) => (name === "styles" ? "useStyles" : `use${name.charAt(0).toUpperCase()}${name.slice(1)}`);

function findTopLevelFunction(path) {
  let current = path;
  let outermost = null;
  while (current) {
    if (current.isFunction()) outermost = current;
    if (current.isClass()) return { kind: "class" };
    current = current.parentPath;
  }
  return outermost ? { kind: "function", path: outermost } : { kind: "module" };
}

function describeFunctionAsComponent(functionPath) {
  const parent = functionPath.parentPath;
  if (functionPath.isFunctionDeclaration()) return isComponentOrHookName(functionPath.node.id?.name);
  if (parent.isVariableDeclarator()) return isComponentOrHookName(parent.node.id.name);
  if (parent.isCallExpression()) {
    const callee = parent.node.callee;
    const calleeName = callee.type === "Identifier" ? callee.name : callee.type === "MemberExpression" ? callee.property.name : "";
    if (calleeName === "memo" || calleeName === "forwardRef") return true;
  }
  if (parent.isExportDefaultDeclaration()) return true;
  return false;
}

function isInsideFunctionParams(referencePath, functionPath) {
  return functionPath.node.params.some((param) => referencePath.node.start >= param.start && referencePath.node.end <= param.end);
}

function migrateSource(source, filePath) {
  const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
  const splices = [];
  const hookLinesByFunction = new Map();
  const report = { convertedStyleSheets: 0, themedComponents: 0, staticLeftovers: [] };
  let colorsBinding = null;
  let colorsImportDeclaration = null;
  let styleSheetsToConvert = [];

  traverse(ast, {
    Program(programPath) {
      const importPath = programPath.get("body").find((statement) => statement.isImportDeclaration() && statement.node.source.value === COLORS_MODULE);
      if (!importPath) return;
      const specifier = importPath.node.specifiers.find((candidate) => candidate.imported?.name === "colors" && candidate.local.name === "colors");
      if (!specifier) return;
      colorsImportDeclaration = importPath;
      colorsBinding = programPath.scope.getBinding("colors");
    },
  });
  if (!colorsBinding) return null;

  traverse(ast, {
    VariableDeclarator(declaratorPath) {
      if (!declaratorPath.parentPath.parentPath.isProgram() && !declaratorPath.parentPath.parentPath.isExportNamedDeclaration()) return;
      const init = declaratorPath.node.init;
      if (!init || init.type !== "CallExpression" || init.callee.type !== "MemberExpression") return;
      if (init.callee.object.name !== "StyleSheet" || init.callee.property.name !== "create" || declaratorPath.node.id.type !== "Identifier") return;
      const usesColors = colorsBinding.referencePaths.some((reference) => reference.node.start >= init.start && reference.node.end <= init.end);
      if (usesColors) styleSheetsToConvert.push(declaratorPath);
    },
  });

  const failures = [];
  const plannedHooks = [];
  for (const declaratorPath of styleSheetsToConvert) {
    const name = declaratorPath.node.id.name;
    const binding = declaratorPath.scope.getBinding(name);
    const owners = new Set();
    for (const reference of binding.referencePaths) {
      const owner = findTopLevelFunction(reference);
      if (owner.kind !== "function" || !describeFunctionAsComponent(owner.path) || isInsideFunctionParams(reference, owner.path)) {
        failures.push(`${name} used outside a component (line ${reference.node.loc.start.line})`);
        continue;
      }
      owners.add(owner.path);
    }
    plannedHooks.push({ declaratorPath, name, owners });
  }
  if (failures.length > 0) return { skipped: failures };

  const convertedRanges = [];
  for (const { declaratorPath, name, owners } of plannedHooks) {
    const init = declaratorPath.node.init;
    const hookName = hookNameForStyles(name);
    splices.push({ start: declaratorPath.node.id.start, end: declaratorPath.node.id.end, text: hookName });
    splices.push({ start: init.start, end: init.start, text: "makeThemedStyles((colors) => " });
    splices.push({ start: init.end, end: init.end, text: ")" });
    convertedRanges.push([init.start, init.end]);
    for (const owner of owners) {
      const lines = hookLinesByFunction.get(owner) ?? [];
      lines.push(`const ${name} = ${hookName}();`);
      hookLinesByFunction.set(owner, lines);
    }
    report.convertedStyleSheets += 1;
  }

  for (const reference of colorsBinding.referencePaths) {
    const insideConvertedSheet = convertedRanges.some(([start, end]) => reference.node.start >= start && reference.node.end <= end);
    if (insideConvertedSheet) continue;
    const owner = findTopLevelFunction(reference);
    const isThemeable = owner.kind === "function" && describeFunctionAsComponent(owner.path) && !isInsideFunctionParams(reference, owner.path) && !owner.path.scope.hasOwnBinding("colors");
    if (!isThemeable) {
      report.staticLeftovers.push(reference.node.loc.start.line);
      continue;
    }
    const lines = hookLinesByFunction.get(owner.path) ?? [];
    if (!lines.includes("const { colors } = useTheme();")) lines.unshift("const { colors } = useTheme();");
    hookLinesByFunction.set(owner.path, lines);
    convertedRanges.push([owner.path.node.body.start, owner.path.node.body.end]);
  }

  for (const reference of colorsBinding.referencePaths) {
    const member = reference.parentPath;
    if (!member.isMemberExpression() || member.node.object !== reference.node || member.node.computed) continue;
    if (!convertedRanges.some(([start, end]) => reference.node.start >= start && reference.node.end <= end)) continue;
    const container = member.parentPath;
    const contextName = container.isObjectProperty() && container.node.value === member.node ? container.node.key.name : container.isJSXExpressionContainer() && container.parentPath.isJSXAttribute() ? container.parentPath.node.name.name : null;
    const rename = contextName ? SEMANTIC_RENAMES_BY_CONTEXT[contextName]?.[member.node.property.name] : undefined;
    if (rename) splices.push({ start: member.node.property.start, end: member.node.property.end, text: rename });
  }

  for (const [functionPath, lines] of hookLinesByFunction) {
    const body = functionPath.node.body;
    report.themedComponents += 1;
    if (body.type === "BlockStatement") {
      splices.push({ start: body.start + 1, end: body.start + 1, text: `\n  ${lines.join("\n  ")}` });
    } else {
      splices.push({ start: body.start, end: body.start, text: `{\n  ${lines.join("\n  ")}\n  return (` });
      splices.push({ start: body.end, end: body.end, text: ");\n}" });
    }
  }

  const usesHookFactory = report.convertedStyleSheets > 0;
  const usesThemeHook = [...hookLinesByFunction.values()].some((lines) => lines.includes("const { colors } = useTheme();"));
  const themeImports = [usesHookFactory && "makeThemedStyles", usesThemeHook && "useTheme"].filter(Boolean);
  if (themeImports.length === 0) return { unchanged: true, report };

  const importNode = colorsImportDeclaration.node;
  const otherSpecifiers = importNode.specifiers.filter((specifier) => specifier.local.name !== "colors");
  const keepStaticImport = report.staticLeftovers.length > 0;
  const themeImportLine = `import { ${themeImports.join(", ")} } from "@/theme";`;
  if (keepStaticImport) {
    splices.push({ start: importNode.end, end: importNode.end, text: `\n${themeImportLine}` });
  } else if (otherSpecifiers.length > 0) {
    const names = otherSpecifiers.map((specifier) => source.slice(specifier.start, specifier.end)).join(", ");
    splices.push({ start: importNode.start, end: importNode.end, text: `import { ${names} } from "${COLORS_MODULE}";\n${themeImportLine}` });
  } else {
    splices.push({ start: importNode.start, end: importNode.end, text: themeImportLine });
  }

  splices.sort((first, second) => second.start - first.start || second.end - first.end);
  let output = source;
  for (const splice of splices) output = output.slice(0, splice.start) + splice.text + output.slice(splice.end);
  return { output, report };
}

const candidates = (onlyPaths.length > 0 ? onlyPaths.map((path) => join(appDirectory, path)) : listSourceFiles(join(appDirectory, "src"))).filter((filePath) => !isDarkFirst(filePath));
const summary = { migrated: [], skipped: [], untouched: 0 };
for (const filePath of candidates) {
  const source = readFileSync(filePath, "utf8");
  if (!source.includes(COLORS_MODULE)) continue;
  const result = migrateSource(source, filePath);
  const relativePath = relative(appDirectory, filePath);
  if (!result || result.unchanged) {
    summary.untouched += 1;
    continue;
  }
  if (result.skipped) {
    summary.skipped.push({ file: relativePath, reasons: result.skipped });
    continue;
  }
  if (!isDryRun) writeFileSync(filePath, result.output);
  summary.migrated.push({ file: relativePath, ...result.report });
}
console.log(JSON.stringify({ migrated: summary.migrated.length, skipped: summary.skipped, untouched: summary.untouched, leftovers: summary.migrated.filter((entry) => entry.staticLeftovers.length > 0).map((entry) => `${entry.file}:${entry.staticLeftovers.join(",")}`) }, null, 2));
