import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { requestOnce, type SafeFetchOptions } from "../../src/integrations/safeHttpFetcher.integration.js";

const options: SafeFetchOptions = { accept: "text/html", maximumBytes: 512 * 1024, truncateAtMaximum: true, timeoutMs: 300, maximumRedirects: 0, isAllowedContentType: () => true };
let server: Server | undefined;

afterEach(() => new Promise<void>((done) => { server?.closeAllConnections(); server?.close(() => done()); }));

describe("SOC-07 safe fetch hard deadline", () => {
  it("aborts a server that drips bytes slower than the total budget but faster than the idle timeout", async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      const drip = setInterval(() => response.write("a"), 50);
      response.on("close", () => clearInterval(drip));
    });
    await new Promise<void>((done) => server?.listen(0, "127.0.0.1", () => done()));
    const { port } = server.address() as AddressInfo;
    const started = Date.now();
    await expect(requestOnce(new URL(`http://drip.example:${port}/`), { address: "127.0.0.1", family: 4 }, options, options.timeoutMs)).rejects.toThrow("timed out");
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
