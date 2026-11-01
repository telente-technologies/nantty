const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scriptSource = fs.readFileSync(path.join(__dirname, "Code.gs"), "utf8");

function createRuntime(initialRows = []) {
  const headers = ["Submitted at", "Email", "Interest", "Consent"];
  const rows = initialRows;
  const sheet = {
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length + 1,
    getRange(row, column, rowCount, columnCount) {
      return {
        getDisplayValues() {
          if (row === 1) {
            return [Array.from({ length: columnCount }, (_, index) => headers[column - 1 + index] || "")];
          }
          return rows.slice(row - 2, row - 2 + rowCount).map((item) =>
            Array.from({ length: columnCount }, (_, index) => String(item[column - 1 + index] || "")),
          );
        },
        setValues(values) {
          values[0].forEach((value, index) => {
            headers[column - 1 + index] = value;
          });
        },
      };
    },
    appendRow: (row) => rows.push(row),
    setFrozenRows: () => {},
  };
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "synthetic-sheet" }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: "ALLOWALL" },
      createHtmlOutput: (html) => ({ html, setXFrameOptionsMode() { return this; } }),
    },
    console: { error: () => {} },
    Date,
  };
  vm.runInNewContext(scriptSource, context);
  return { context, headers, rows };
}

function submit(context, parameter, parameters = {}) {
  const response = context.doPost({ parameter, parameters });
  const match = response.html.match(/window\.top\.postMessage\((\{.*\}),\s*("https:\/\/[^"\\]+")\);/);
  return match ? JSON.parse(match[1]) : null;
}

test("seller submissions write optional details and keep marketing consent separate", () => {
  const { context, headers, rows } = createRuntime();
  const result = submit(context, {
    origin: "https://nantty.com",
    nonce: "seller-nonce",
    email: "seller@example.test",
    interest: "seller",
    processingConsent: "yes",
    fullName: "=2+2",
    productCategory: "Fashion and clothing",
    phone: "+234 800 123 4567",
    monthlySales: "25000",
    productCount: "12",
    foundingSellerBeta: "yes",
    listingTiming: "Not sure yet",
  }, { salesChannels: ["Instagram", "WhatsApp"] });

  assert.equal(result.status, "saved");
  assert.equal(rows.length, 1);
  assert.equal(headers[3], "Marketing consent");
  assert.equal(rows[0].length, 15);
  assert.equal(rows[0][3], "no");
  assert.equal(rows[0][4], "yes");
  assert.equal(rows[0][5], "'=2+2");
  assert.equal(rows[0][9], "Instagram, WhatsApp");
});

test("buyer submissions do not store seller-only fields", () => {
  const { context, rows } = createRuntime();
  const result = submit(context, {
    origin: "https://nantty.com",
    nonce: "buyer-nonce",
    email: "buyer@example.test",
    interest: "buyer",
    processingConsent: "yes",
    consent: "yes",
    fullName: "Not relevant to a buyer request",
  });

  assert.equal(result.status, "saved");
  assert.equal(rows[0][3], "yes");
  assert.equal(rows[0][5], "");
  assert.equal(rows[0][14], "public_waitlist");
});

test("duplicate email submissions are idempotently rejected", () => {
  const { context, rows } = createRuntime();
  const request = {
    origin: "https://nantty.com",
    nonce: "duplicate-nonce",
    email: "same@example.test",
    interest: "buyer",
    processingConsent: "yes",
  };

  assert.equal(submit(context, request).status, "saved");
  assert.equal(submit(context, { ...request, nonce: "second-nonce", email: " SAME@example.test " }).status, "duplicate");
  assert.equal(rows.length, 1);
});

test("legacy seller rows can re-confirm without overwriting their history", () => {
  const legacyRow = Array(15).fill("");
  legacyRow[1] = "legacy@example.test";
  legacyRow[2] = "seller";
  legacyRow[3] = "Not captured";
  legacyRow[14] = "Legacy founding-seller response; marketing consent was not captured";
  const { context, rows } = createRuntime([legacyRow]);
  const result = submit(context, {
    origin: "https://nantty.com",
    nonce: "legacy-confirm-nonce",
    email: "legacy@example.test",
    interest: "seller",
    processingConsent: "yes",
    consent: "yes",
  });

  assert.equal(result.status, "saved");
  assert.equal(rows.length, 2);
  assert.equal(rows[0][3], "Not captured");
  assert.equal(rows[1][3], "yes");
});

test("seller fields are validated before writing", () => {
  const { context, rows } = createRuntime();
  const result = submit(context, {
    origin: "https://nantty.com",
    nonce: "invalid-nonce",
    email: "invalid@example.test",
    interest: "seller",
    processingConsent: "yes",
    productCategory: "Unexpected category",
  });

  assert.equal(result.status, "error");
  assert.equal(rows.length, 0);
});

test("unapproved origins receive no cross-origin response and write no data", () => {
  const { context, rows } = createRuntime();
  const result = submit(context, {
    origin: "https://untrusted.example",
    nonce: "origin-nonce",
    email: "untrusted@example.test",
    interest: "buyer",
    processingConsent: "yes",
  });

  assert.equal(result, null);
  assert.equal(rows.length, 0);
});

test("user-controlled nonce is escaped before embedding the response in HTML", () => {
  const { context, rows } = createRuntime();
  const nonce = "</script><img src=x>";
  const response = context.doPost({
    parameter: {
      origin: "https://nantty.com",
      nonce,
      email: "html@example.test",
      interest: "buyer",
      processingConsent: "yes",
    },
    parameters: {},
  });

  assert.match(response.html, /\\u003c\/script\\u003e/);
  assert.doesNotMatch(response.html, /<\/script><img/);
  assert.equal(rows.length, 1);
});
