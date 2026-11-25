import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createClamAvTcpScanner } from "../../src/integrations/clamAvTcpScanner.integration.js";

const host = process.env["CLAMAV_TEST_HOST"];
describe.skipIf(host === undefined || host === "")("live ClamAV scanner", () => {
  it("accepts a harmless clean file and detects the EICAR test signature", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nantty-clamav-live-"));
    try {
      const cleanFile = join(directory, "clean.txt");
      const eicarFile = join(directory, "eicar.com");
      await writeFile(cleanFile, "Nantty ClamAV scanner health check: clean test payload.\n");
      await writeFile(eicarFile, "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
      const scanner = createClamAvTcpScanner({ host: host!, port: Number(process.env["CLAMAV_TEST_PORT"] ?? "3310"), timeoutMs: 720_000 });
      await expect(scanner.scanFile(cleanFile)).resolves.toEqual({ verdict: "clean" });
      await expect(scanner.scanFile(eicarFile)).resolves.toMatchObject({ verdict: "infected" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
