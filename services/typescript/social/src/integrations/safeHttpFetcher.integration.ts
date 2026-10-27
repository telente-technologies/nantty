import { lookup as lookupHostAddresses } from "node:dns/promises";
import { request as sendHttpRequest, type IncomingMessage } from "node:http";
import { request as sendHttpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

import { assertUrlIsSafeToFetch, BlockedUrlError, resolvePublicAddressOrThrow, type AddressLookup, type ResolvedAddress } from "../utils/ssrfGuard.util.js";

export const linkPreviewUserAgent = "NanttyBot/1.0 (+https://nantty.com/bot; link previews)";

export interface SafeFetchOptions {
  readonly accept: string;
  readonly maximumBytes: number;
  readonly truncateAtMaximum: boolean;
  readonly timeoutMs: number;
  readonly maximumRedirects: number;
  readonly isAllowedContentType: (contentType: string) => boolean;
}

export interface SafeFetchResult {
  readonly finalUrl: URL;
  readonly status: number;
  readonly contentType: string;
  readonly body: Buffer;
}

export type SafeFetcher = (rawUrl: string, options: SafeFetchOptions) => Promise<SafeFetchResult>;

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export const systemAddressLookup: AddressLookup = async (hostname) =>
  (await lookupHostAddresses(hostname, { all: true, verbatim: true })).map((entry) => ({ address: entry.address, family: entry.family }));

function buildPinnedLookup(pinned: ResolvedAddress): LookupFunction {
  return ((_hostname: string, lookupOptions: { all?: boolean }, callback: (error: Error | null, address: unknown, family?: number) => void) => {
    if (lookupOptions.all === true) callback(null, [{ address: pinned.address, family: pinned.family }]);
    else callback(null, pinned.address, pinned.family);
  }) as unknown as LookupFunction;
}

export interface SingleResponse {
  readonly status: number;
  readonly location: string | undefined;
  readonly contentType: string;
  readonly body: Buffer;
}

function readResponseWithinLimit(response: IncomingMessage, options: SafeFetchOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(response.headers["content-length"] ?? 0);
    if (declaredLength > options.maximumBytes && !options.truncateAtMaximum) {
      response.destroy();
      reject(new BlockedUrlError("response is too large"));
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    response.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > options.maximumBytes) {
        if (!options.truncateAtMaximum) {
          response.destroy();
          reject(new BlockedUrlError("response is too large"));
          return;
        }
        chunks.push(chunk.subarray(0, chunk.length - (total - options.maximumBytes)));
        response.destroy();
        resolve(Buffer.concat(chunks));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => resolve(Buffer.concat(chunks)));
    response.on("error", reject);
  });
}

export function requestOnce(url: URL, pinned: ResolvedAddress, options: SafeFetchOptions, timeoutMs: number): Promise<SingleResponse> {
  return new Promise((settleResolve, settleReject) => {
    let hardDeadline: NodeJS.Timeout | undefined;
    const resolve = (value: SingleResponse) => { clearTimeout(hardDeadline); settleResolve(value); };
    const reject = (error: unknown) => { clearTimeout(hardDeadline); settleReject(error); };
    const send = url.protocol === "https:" ? sendHttpsRequest : sendHttpRequest;
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const request = send({
      protocol: url.protocol,
      hostname,
      port: url.port === "" ? undefined : Number(url.port),
      path: `${url.pathname}${url.search}`,
      method: "GET",
      lookup: buildPinnedLookup(pinned),
      timeout: timeoutMs,
      ...(url.protocol === "https:" && isIP(hostname) === 0 ? { servername: hostname } : {}),
      headers: { "user-agent": linkPreviewUserAgent, accept: options.accept, "accept-language": "en", "accept-encoding": "identity" },
    }, (response) => {
      const status = response.statusCode ?? 0;
      const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
      if (redirectStatuses.has(status)) {
        response.resume();
        resolve({ status, location: response.headers.location, contentType, body: Buffer.alloc(0) });
        return;
      }
      if (status < 200 || status >= 300 || !options.isAllowedContentType(contentType)) {
        response.resume();
        resolve({ status, location: undefined, contentType, body: Buffer.alloc(0) });
        return;
      }
      readResponseWithinLimit(response, options).then((body) => resolve({ status, location: undefined, contentType, body }), reject);
    });
    hardDeadline = setTimeout(() => {
      reject(new BlockedUrlError("timed out"));
      request.destroy(new BlockedUrlError("timed out"));
    }, timeoutMs);
    request.on("timeout", () => request.destroy(new BlockedUrlError("timed out")));
    request.on("error", reject);
    request.end();
  });
}

export type SingleRequestSender = (url: URL, pinned: ResolvedAddress, options: SafeFetchOptions, timeoutMs: number) => Promise<SingleResponse>;

export function createSafeHttpFetcher(lookup: AddressLookup = systemAddressLookup, sendSingleRequest: SingleRequestSender = requestOnce): SafeFetcher {
  return async (rawUrl, options) => {
    const deadline = Date.now() + options.timeoutMs;
    let current = assertUrlIsSafeToFetch(rawUrl);
    for (let hop = 0; hop <= options.maximumRedirects; hop += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new BlockedUrlError("timed out");
      const pinned = await resolvePublicAddressOrThrow(current.hostname, lookup);
      const response = await sendSingleRequest(current, pinned, options, remaining);
      if (response.location === undefined) return { finalUrl: current, status: response.status, contentType: response.contentType, body: response.body };
      current = assertUrlIsSafeToFetch(new URL(response.location, current).toString());
    }
    throw new BlockedUrlError("too many redirects");
  };
}
