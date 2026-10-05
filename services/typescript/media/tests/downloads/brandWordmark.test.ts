import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { symbolLeftHalfPath, symbolPath, symbolRightHalfPath, wordmarkPath, wordmarkSmallPath } from "../../src/constants/brandWordmark.constant.js";
import { getWordmarkRaster } from "../../src/integrations/brandWordmarkAssets.integration.js";
import { composeEndCardLogoPng, composeWatermarkPng } from "../../src/integrations/brandedDownloadRenderer.integration.js";
import { buildBrandWatermarkSvg, computeWatermarkBox } from "../../src/utils/brandWatermark.util.js";

const webKitBrandPath = fileURLToPath(new URL("../../../../../packages/webKit/src/brand/zudomartBrand.path.ts", import.meta.url));
const webKitSymbolPath = fileURLToPath(new URL("../../../../../packages/webKit/src/brand/zudomartSymbol.path.ts", import.meta.url));

describe("brand wordmark and symbol assets", () => {
  it("uses the same paths as the apps", async () => {
    const source = await readFile(webKitBrandPath, "utf8");
    for (const path of [wordmarkPath, wordmarkSmallPath]) expect(source).toContain(path.d);
    expect(await readFile(webKitSymbolPath, "utf8")).toContain(symbolPath);
    expect(symbolLeftHalfPath + symbolRightHalfPath).toBe(symbolPath);
  });

  it("draws no typed wordmark text in the badge", () => {
    const svg = buildBrandWatermarkSvg(computeWatermarkBox(1280, 720, "ada", 0.075), "ada", 0.78);
    expect(svg).not.toContain(">zudomart<");
    expect(svg).toContain(symbolPath);
  });

  it("rasterises once per size and reuses the PNG", async () => {
    const first = getWordmarkRaster(20, "badge");
    expect(getWordmarkRaster(20, "badge")).toBe(first);
    const raster = await first;
    const meta = await sharp(raster.png).metadata();
    expect([meta.width, meta.height]).toEqual([raster.width, raster.height]);
  });

  it("stamps the wordmark into the badge and the end card", async () => {
    const box = computeWatermarkBox(1280, 720, "ada", 0.075);
    const badge = await sharp(await composeWatermarkPng(box, "ada", 1)).metadata();
    expect([badge.width, badge.height]).toEqual([box.width, box.height]);
    const card = await composeEndCardLogoPng({ width: 400, height: 200 }, "ada");
    const { data, info } = await sharp(card).raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    for (let y = 120; y < 170; y++) for (let x = 0; x < info.width; x++) if ((data[(y * info.width + x) * info.channels + 3] ?? 0) > 200) opaque++;
    expect(opaque).toBeGreaterThan(400);
  });
});
