/**
 * Nantty waitlist intake. Deploy as a Google Apps Script web app owned by
 * the business and bound to a restricted Google Sheet. No credentials belong
 * in the Next.js/static-site bundle.
 */
const CONFIG = {
  spreadsheetId: "REPLACE_WITH_RESTRICTED_SHEET_ID",
  sheetName: "Waitlist",
  allowedOrigins: ["https://nantty.com", "https://www.nantty.com"],
};

function doPost(event) {
  const values = event && event.parameter ? event.parameter : {};
  const nonce = String(values.nonce || "").slice(0, 100);
  let status = "error";
  let message = "We could not save your request. Please try again later.";

  try {
    const origin = String(values.origin || "");
    const email = String(values.email || "").trim().toLowerCase();
    const interest = String(values.interest || "");
    const consent = values.consent === "yes";
    const honeypot = String(values.website || "").trim();

    if (!nonce || CONFIG.spreadsheetId.indexOf("REPLACE_") === 0) throw new Error("Setup incomplete");
    if (CONFIG.allowedOrigins.indexOf(origin) === -1) throw new Error("Origin rejected");
    if (honeypot) throw new Error("Automated submission");
    if (!consent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Invalid submission");
    if (["buyer", "seller", "creator"].indexOf(interest) === -1) throw new Error("Invalid interest");

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheetName);
      if (!sheet) throw new Error("Waitlist sheet missing");
      if (sheet.getLastRow() > 1) {
        const existing = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getDisplayValues();
        if (existing.some(function (row) { return String(row[0]).trim().toLowerCase() === email; })) {
          status = "duplicate";
          message = "You are already on the list. Thanks for your interest.";
        }
      }
      if (status !== "duplicate") {
        sheet.appendRow([new Date(), email, interest, "yes"]);
        status = "saved";
        message = "You are on the list. Thanks for your interest in Nantty.";
      }
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error("Waitlist submission rejected", error && error.message ? error.message : "unknown");
  }

  const payload = JSON.stringify({ type: "nantty-waitlist", nonce: nonce, status: status, message: message });
  const html = '<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' + payload + ', "*");</script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupWaitlistSheet() {
  if (CONFIG.spreadsheetId.indexOf("REPLACE_") === 0) throw new Error("Set CONFIG.spreadsheetId first.");
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Submitted at", "Email", "Interest", "Consent"]);
    sheet.setFrozenRows(1);
  }
}
