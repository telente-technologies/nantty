import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgDirectory = join(appDirectory, "assets/icons");
const outputDirectory = join(appDirectory, "src/components/icons/generated");

const toPascalCase = (name) => name.charAt(0).toUpperCase() + name.slice(1);

function readSvgShapes(svg) {
  return [...svg.matchAll(/<(path|rect) ([^>]*)\/>/g)].map(([, tag, attributes]) => ({
    tag,
    attributes: Object.fromEntries([...attributes.matchAll(/([a-z-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])),
  }));
}

function findMostUsedFillColor(shapes) {
  const fillCounts = {};
  for (const shape of shapes) fillCounts[shape.attributes.fill] = (fillCounts[shape.attributes.fill] ?? 0) + 1;
  return Object.entries(fillCounts).sort((first, second) => second[1] - first[1])[0][0];
}

function renderShapeAsJsx({ tag, attributes }, inkColor) {
  const fill = attributes.fill === inkColor ? "{color ?? ink}" : JSON.stringify(attributes.fill);
  const shared = [
    `transform=${JSON.stringify(attributes.transform)}`,
    `fill=${fill}`,
    attributes["fill-opacity"] ? `fillOpacity={${attributes["fill-opacity"]}}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return tag === "path"
    ? `      <Path d=${JSON.stringify(attributes.d)} fillRule=${JSON.stringify(attributes["fill-rule"])} ${shared} />`
    : `      <Rect width={${attributes.width}} height={${attributes.height}} rx={${attributes.rx}} ${shared} />`;
}

function generateIconComponentFile(svgFileName) {
  const baseName = svgFileName.replace(/\.svg$/, "");
  const svg = readFileSync(join(svgDirectory, svgFileName), "utf8");
  const [, width, height] = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  const shapes = readSvgShapes(svg);
  const inkColor = findMostUsedFillColor(shapes);
  const componentName = `${toPascalCase(baseName)}Icon`;
  const svgImports = [shapes.some((s) => s.tag === "path") && "Path", shapes.some((s) => s.tag === "rect") && "Rect"].filter(Boolean);
  writeFileSync(
    join(outputDirectory, `${baseName}.tsx`),
    `import Svg, { ${svgImports.join(", ")} } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function ${componentName}({ size, color, style }: IconProps) {
  const ink = useThemedIconInk(${JSON.stringify(inkColor)});
  const scale = size === undefined ? 1 : size / ${width};
  return (
    <Svg width={${width} * scale} height={${height} * scale} viewBox="0 0 ${width} ${height}" fill="none" style={style}>
${shapes.map((shape) => renderShapeAsJsx(shape, inkColor)).join("\n")}
    </Svg>
  );
}
`,
  );
  return `export { ${componentName} } from "./${baseName}";`;
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
const exportLines = readdirSync(svgDirectory)
  .filter((fileName) => fileName.endsWith(".svg"))
  .sort()
  .map(generateIconComponentFile);
writeFileSync(join(outputDirectory, "index.ts"), `${exportLines.join("\n")}\n`);
console.log(`Generated ${exportLines.length} icon components from assets/icons`);
