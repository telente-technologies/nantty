import { encodeProductBarcode } from "@/utils/barcodeSymbology.util";

const quietZoneModules = 9;

function collectBarRuns(modules: string): { start: number; width: number }[] {
  const runs: { start: number; width: number }[] = [];
  let index = 0;
  while (index < modules.length) {
    if (modules[index] === "1") {
      const start = index;
      while (modules[index] === "1") index += 1;
      runs.push({ start, width: index - start });
    } else index += 1;
  }
  return runs;
}

export function BarcodeSvg({ barcode, sku, className }: { readonly barcode: string | null; readonly sku: string; readonly className?: string }) {
  const encoded = encodeProductBarcode(barcode, sku);
  if (!encoded) return <span className={className}>No printable code</span>;
  const totalWidth = encoded.modules.length + quietZoneModules * 2;
  return (
    <svg className={className} viewBox={`0 0 ${totalWidth} 40`} preserveAspectRatio="none" role="img" aria-label={`${encoded.symbology} barcode ${encoded.humanReadableText}`} shapeRendering="crispEdges">
      <rect width={totalWidth} height="40" fill="#fff" />
      {collectBarRuns(encoded.modules).map((run) => (
        <rect key={run.start} x={run.start + quietZoneModules} y="0" width={run.width} height="40" fill="#000" />
      ))}
    </svg>
  );
}
