import { describe, expect, it } from "vitest";

import { areMimeTypesCompatible, kindOfMimeType, sniffMimeType } from "../../src/utils/magicBytes.util.js";
import { countPdfPages, pdfContainsActiveContent } from "../../src/utils/pdfPageCount.util.js";

const ftyp = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftyp"), Buffer.from(brand.padEnd(4, " ")), Buffer.alloc(12)]);
const riff = (form: string) => Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from(form), Buffer.alloc(8)]);

describe("magic byte sniffing", () => {
  it.each([
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])],
    ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])],
    ["image/webp", riff("WEBP")],
    ["audio/wav", riff("WAVE")],
    ["image/heic", ftyp("heic")],
    ["image/avif", ftyp("avif")],
    ["video/mp4", ftyp("isom")],
    ["video/quicktime", ftyp("qt")],
    ["audio/mp4", ftyp("M4A")],
    ["video/webm", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0])],
    ["application/pdf", Buffer.from("%PDF-1.7\n")],
    ["audio/ogg", Buffer.from("OggS\0\0")],
    ["audio/mpeg", Buffer.from("ID3\u0004\0\0")],
  ])("recognises %s", (expected, bytes) => {
    expect(sniffMimeType(bytes)).toBe(expected);
  });

  it("does not recognise executables, scripts, svg or empty input", () => {
    expect(sniffMimeType(Buffer.from("MZ\x90\0"))).toBeUndefined();
    expect(sniffMimeType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeUndefined();
    expect(sniffMimeType(Buffer.from("#!/bin/sh\n"))).toBeUndefined();
    expect(sniffMimeType(new Uint8Array())).toBeUndefined();
  });

  it("flags a declared type that disagrees with the real bytes", () => {
    expect(areMimeTypesCompatible("image/jpeg", "image/png")).toBe(false);
    expect(areMimeTypesCompatible("image/jpeg", "application/pdf")).toBe(false);
    expect(areMimeTypesCompatible("image/jpg", "image/jpeg")).toBe(true);
    expect(areMimeTypesCompatible("video/quicktime", "video/mp4")).toBe(true);
    expect(areMimeTypesCompatible("image/heif", "image/heic")).toBe(true);
    expect(areMimeTypesCompatible("audio/x-m4a", "audio/mp4")).toBe(true);
  });

  it("maps mime types to media kinds", () => {
    expect([kindOfMimeType("image/png"), kindOfMimeType("video/mp4"), kindOfMimeType("audio/ogg"), kindOfMimeType("application/pdf"), kindOfMimeType("text/html")]).toEqual(["image", "video", "audio", "document", undefined]);
  });
});

describe("pdf inspection", () => {
  const pdf = (body: string) => Buffer.from(`%PDF-1.4\n${body}\n%%EOF`);

  it("reads the declared page count from the page tree", () => {
    expect(countPdfPages(pdf("1 0 obj << /Type /Pages /Count 7 /Kids [] >> endobj"))).toBe(7);
  });

  it("falls back to counting leaf pages and refuses truncated files", () => {
    expect(countPdfPages(pdf("<< /Type /Page >> << /Type /Page >> << /Type /Pages >>"))).toBe(2);
    expect(countPdfPages(Buffer.from("%PDF-1.4\n<< /Type /Page >>"))).toBeUndefined();
  });

  it("detects javascript and launch actions", () => {
    expect(pdfContainsActiveContent(pdf("<< /S /JavaScript /JS (app.alert(1)) >>"))).toBe(true);
    expect(pdfContainsActiveContent(pdf("<< /Type /Page >>"))).toBe(false);
  });
});
