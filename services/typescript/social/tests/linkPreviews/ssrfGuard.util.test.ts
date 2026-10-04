import { describe, expect, it } from "vitest";

import { createSafeHttpFetcher, type SafeFetchOptions, type SingleRequestSender } from "../../src/integrations/safeHttpFetcher.integration.js";
import { assertUrlIsSafeToFetch, BlockedUrlError, isPublicIpAddress, resolvePublicAddressOrThrow, type AddressLookup } from "../../src/utils/ssrfGuard.util.js";

const htmlOptions: SafeFetchOptions = { accept: "text/html", maximumBytes: 1024, truncateAtMaximum: true, timeoutMs: 2000, maximumRedirects: 3, isAllowedContentType: () => true };

describe("isPublicIpAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fe80::1", "fc00::1", "fd00:ec2::254", "ff02::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::", "2001:db8::1", "fec0::1",
  ])("blocks %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111", "2a00:1450:4009:81f::200e", "::ffff:8.8.8.8"])("allows %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });
});

describe("assertUrlIsSafeToFetch", () => {
  it.each([
    "file:///etc/passwd", "ftp://example.com/x", "gopher://example.com", "javascript:alert(1)", "http://user:pass@example.com/", "http://example.com:8080/",
    "http://localhost/", "http://LOCALHOST./", "http://api.internal/", "http://printer.local/", "http://127.0.0.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/",
    "http://169.254.169.254/latest/meta-data/", "http://2130706433/", "http://0x7f000001/", "http://metadata.google.internal/", "http://intranet/", "not a url",
  ])("rejects %s", (url) => {
    expect(() => assertUrlIsSafeToFetch(url)).toThrow(BlockedUrlError);
  });

  it.each(["https://example.com/article?id=1", "http://news.example.co.uk/", "https://93.184.216.34/"])("accepts %s", (url) => {
    expect(assertUrlIsSafeToFetch(url).toString()).toContain("://");
  });
});

describe("resolvePublicAddressOrThrow", () => {
  it("rejects a hostname when any resolved address is private (DNS rebinding style)", async () => {
    const lookup: AddressLookup = async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }];
    await expect(resolvePublicAddressOrThrow("evil.example", lookup)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("rejects an IPv6-only private answer", async () => {
    await expect(resolvePublicAddressOrThrow("evil.example", async () => [{ address: "fd12::1", family: 6 }])).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("rejects unresolvable hosts", async () => {
    await expect(resolvePublicAddressOrThrow("missing.example", async () => { throw new Error("ENOTFOUND"); })).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("returns the first public address", async () => {
    await expect(resolvePublicAddressOrThrow("ok.example", async () => [{ address: "93.184.216.34", family: 4 }])).resolves.toEqual({ address: "93.184.216.34", family: 4 });
  });
});

describe("createSafeHttpFetcher", () => {
  const publicLookup: AddressLookup = async (hostname) => (hostname === "private.example" ? [{ address: "192.168.0.10", family: 4 }] : [{ address: "93.184.216.34", family: 4 }]);

  it("never connects to a host that resolves to a private address", async () => {
    let connected = false;
    const sender: SingleRequestSender = async () => {
      connected = true;
      return { status: 200, location: undefined, contentType: "text/html", body: Buffer.from("ok") };
    };
    await expect(createSafeHttpFetcher(publicLookup, sender)("https://private.example/", htmlOptions)).rejects.toBeInstanceOf(BlockedUrlError);
    expect(connected).toBe(false);
  });

  it("re-validates every redirect hop and refuses redirects to metadata or private hosts", async () => {
    for (const location of ["http://169.254.169.254/latest/meta-data/", "https://private.example/", "http://localhost/", "file:///etc/passwd"]) {
      const sender: SingleRequestSender = async () => ({ status: 302, location, contentType: "", body: Buffer.alloc(0) });
      await expect(createSafeHttpFetcher(publicLookup, sender)("https://public.example/", htmlOptions)).rejects.toBeInstanceOf(BlockedUrlError);
    }
  });

  it("pins the connection to the validated address and follows safe redirects", async () => {
    const hops: string[] = [];
    const sender: SingleRequestSender = async (url, pinned) => {
      hops.push(`${url.hostname}@${pinned.address}`);
      return url.pathname === "/start"
        ? { status: 301, location: "/final", contentType: "", body: Buffer.alloc(0) }
        : { status: 200, location: undefined, contentType: "text/html", body: Buffer.from("<title>x</title>") };
    };
    const result = await createSafeHttpFetcher(publicLookup, sender)("https://public.example/start", htmlOptions);
    expect(result.finalUrl.pathname).toBe("/final");
    expect(hops).toEqual(["public.example@93.184.216.34", "public.example@93.184.216.34"]);
  });

  it("stops after too many redirects", async () => {
    const sender: SingleRequestSender = async () => ({ status: 302, location: "/again", contentType: "", body: Buffer.alloc(0) });
    await expect(createSafeHttpFetcher(publicLookup, sender)("https://public.example/", htmlOptions)).rejects.toThrow("too many redirects");
  });
});
