/**
 * Nantty waitlist intake. Deploy as a Google Apps Script web app owned by
 * the business and bound to a restricted Google Sheet. No credentials belong
 * in the Next.js/static-site bundle.
 */
const CONFIG = {
  spreadsheetId: PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "",
  sheetName: "Sheet1",
  allowedOrigins: ["https://nantty.com", "https://www.nantty.com"],
};

const HEADERS = [
  "Submitted at",
  "Email",
  "Interest",
  "Marketing consent",
  "Waitlist processing consent",
  "Full name",
  "Store/business name",
  "Phone / WhatsApp",
  "Product category",
  "Current sales channels",
  "Approx monthly sales (NGN)",
  "Products planned for launch",
  "Founding seller beta interest",
  "Expected listing timing",
  "Record source / consent note",
];

const PRODUCT_CATEGORIES = [
  "Fashion and clothing",
  "Beauty and personal care",
  "Food and groceries",
  "Home and kitchen",
  "Health and wellness",
  "Phones and gadgets",
  "Perfume and fragrance",
  "Other",
];
const SALES_CHANNELS = [
  "Instagram",
  "WhatsApp",
  "TikTok",
  "Facebook",
  "Physical shop",
  "Online store",
  "Other",
];
const LISTING_TIMINGS = [
  "As soon as the closed beta opens",
  "Within 1 month of launch",
  "Not sure yet",
];

function doPost(event) {
  const values = event && event.parameter ? event.parameter : {};
  const allValues = event && event.parameters ? event.parameters : {};
  const nonce = cleanText(values.nonce, 100);
  const origin = cleanText(values.origin, 200);
  let targetOrigin = CONFIG.allowedOrigins.indexOf(origin) >= 0 ? origin : "";
  let status = "error";
  let message = "We could not save your request. Please try again later.";

  try {
    const email = cleanText(values.email, 254).toLowerCase();
    const interest = cleanText(values.interest, 20);
    const processingConsent = values.processingConsent === "yes";
    const marketingConsent = values.consent === "yes";
    const honeypot = cleanText(values.website, 200);

    if (!nonce || !CONFIG.spreadsheetId) throw new Error("Setup incomplete");
    if (!targetOrigin) throw new Error("Origin rejected");
    if (honeypot) throw new Error("Automated submission");
    if (!processingConsent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new Error("Invalid submission");
    }
    if (["buyer", "seller", "creator"].indexOf(interest) === -1) throw new Error("Invalid interest");

    const sellerDetails = interest === "seller" ? parseSellerDetails(values, allValues) : emptySellerDetails();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheetName);
      if (!sheet) throw new Error("Waitlist sheet missing");
      ensureHeaders(sheet);

      if (sheet.getLastRow() > 1) {
        const existing = sheet.getRange(2, 2, sheet.getLastRow() - 1, HEADERS.length - 1).getDisplayValues();
        if (existing.some(function (row) {
          const sameEmail = String(row[0]).trim().toLowerCase() === email;
          const source = String(row[HEADERS.length - 2] || "").trim().toLowerCase();
          return sameEmail && source.indexOf("legacy") !== 0;
        })) {
          status = "duplicate";
          message = "You are already on the list. Thanks for your interest.";
        }
      }
      if (status !== "duplicate") {
        sheet.appendRow([
          new Date(),
          safeCell(email),
          interest,
          marketingConsent ? "yes" : "no",
          "yes",
          safeCell(sellerDetails.fullName),
          safeCell(sellerDetails.businessName),
          safeCell(sellerDetails.phone),
          sellerDetails.productCategory,
          sellerDetails.salesChannels.join(", "),
          sellerDetails.monthlySales,
          sellerDetails.productCount,
          sellerDetails.foundingSellerBeta,
          sellerDetails.listingTiming,
          "public_waitlist",
        ]);
        status = "saved";
        message = "You are on the list. Thanks for your interest in Nantty.";
      }
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error("Waitlist submission rejected", error && error.message ? error.message : "unknown");
  }

  const payload = serializePayload({ type: "nantty-waitlist", nonce: nonce, status: status, message: message });
  const script = targetOrigin
    ? "window.top.postMessage(" + payload + ", " + JSON.stringify(targetOrigin) + ");"
    : "";
  const html = '<!doctype html><meta charset="utf-8"><script>' + script + "</script>";
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

function serializePayload(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function safeCell(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function parseInteger(value, maxValue, label) {
  const text = cleanText(value, 16);
  if (!text) return "";
  if (!/^\d+$/.test(text)) throw new Error("Invalid " + label);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maxValue) throw new Error("Invalid " + label);
  return parsed;
}

function parseSellerDetails(values, allValues) {
  const phone = cleanText(values.phone, 32);
  if (phone && !/^\+?[0-9\s().-]{7,32}$/.test(phone)) throw new Error("Invalid phone");
  const productCategory = cleanText(values.productCategory, 80);
  if (productCategory && PRODUCT_CATEGORIES.indexOf(productCategory) === -1) throw new Error("Invalid category");
  const salesChannels = allValues.salesChannels || (values.salesChannels ? [values.salesChannels] : []);
  const selectedChannels = Array.from(new Set(salesChannels.map(function (value) { return cleanText(value, 40); })));
  if (selectedChannels.some(function (value) { return SALES_CHANNELS.indexOf(value) === -1; })) throw new Error("Invalid sales channel");

  const foundingSellerBeta = cleanText(values.foundingSellerBeta, 8);
  if (foundingSellerBeta && ["yes", "no"].indexOf(foundingSellerBeta) === -1) throw new Error("Invalid beta preference");
  const listingTiming = cleanText(values.listingTiming, 80);
  if (listingTiming && LISTING_TIMINGS.indexOf(listingTiming) === -1) throw new Error("Invalid listing timeframe");

  return {
    fullName: cleanText(values.fullName, 120),
    businessName: cleanText(values.businessName, 160),
    phone: phone,
    productCategory: productCategory,
    salesChannels: selectedChannels,
    monthlySales: parseInteger(values.monthlySales, 999999999999, "monthly sales"),
    productCount: parseInteger(values.productCount, 1000000, "product count"),
    foundingSellerBeta: foundingSellerBeta,
    listingTiming: listingTiming,
  };
}

function emptySellerDetails() {
  return {
    fullName: "",
    businessName: "",
    phone: "",
    productCategory: "",
    salesChannels: [],
    monthlySales: "",
    productCount: "",
    foundingSellerBeta: "",
    listingTiming: "",
  };
}

function ensureHeaders(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  if (!current[0]) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    if (current.length > HEADERS.length) throw new Error("Unexpected waitlist columns");
    if (current[0] !== HEADERS[0] || current[1] !== HEADERS[1] || current[2] !== HEADERS[2]) {
      throw new Error("Unexpected waitlist headers");
    }
    if (current[3] === "Consent") current[3] = HEADERS[3];
    for (let index = 0; index < current.length; index += 1) {
      if (current[index] && current[index] !== HEADERS[index]) throw new Error("Unexpected waitlist header at column " + (index + 1));
    }
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  sheet.setFrozenRows(1);
}

function setupWaitlistSheet() {
  if (!CONFIG.spreadsheetId) throw new Error("Set the SPREADSHEET_ID script property first.");
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.sheetName);
  ensureHeaders(sheet);
}
