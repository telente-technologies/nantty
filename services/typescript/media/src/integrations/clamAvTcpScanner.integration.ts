import { createReadStream } from "node:fs";
import { once } from "node:events";
import { connect } from "node:net";

import type { MalwareScanner, ScanVerdict } from "../interfaces/malwareScanner.interface.js";

const clamAvChunkBytes = 64 * 1024;

export function parseClamAvResponse(response: string): ScanVerdict {
  const text = response.replaceAll("\0", "").trim();
  if (text.endsWith("OK")) return { verdict: "clean" };
  const found = /^stream:\s*(.+)\s+FOUND$/.exec(text);
  if (found?.[1] !== undefined) return { verdict: "infected", signature: found[1] };
  throw new Error(`unexpected clamd response: ${text.slice(0, 120)}`);
}

export function createClamAvTcpScanner(options: { readonly host: string; readonly port: number; readonly timeoutMs?: number }): MalwareScanner {
  return {
    scanFile: (path) =>
      new Promise<ScanVerdict>((resolve, reject) => {
        const socket = connect({ host: options.host, port: options.port });
        socket.setTimeout(options.timeoutMs ?? 120_000, () => socket.destroy(new Error("clamd timed out")));
        let response = "";
        socket.on("data", (chunk) => (response += chunk.toString("utf8")));
        socket.on("error", reject);
        socket.on("close", () => {
          try {
            resolve(parseClamAvResponse(response));
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
        socket.on("connect", async () => {
          const source = createReadStream(path, { highWaterMark: clamAvChunkBytes });
          try {
            await writeSocketChunk(socket, Buffer.from("zINSTREAM\0"));
            for await (const chunk of source) {
              const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
              const length = Buffer.alloc(4);
              length.writeUInt32BE(bytes.length);
              await writeSocketChunk(socket, length);
              await writeSocketChunk(socket, bytes);
            }
            await writeSocketChunk(socket, Buffer.alloc(4));
          } catch (error) {
            source.destroy();
            socket.destroy(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }),
  };
}

async function writeSocketChunk(socket: ReturnType<typeof connect>, bytes: Buffer): Promise<void> {
  if (socket.destroyed) throw new Error("clamd connection closed before upload completed");
  if (socket.write(bytes)) return;
  await once(socket, "drain");
}

export const skippedMalwareScanner: MalwareScanner = { scanFile: async () => ({ verdict: "skipped" }) };
