/**
 * Nantty waitlist intake. This web app runs as the owner and writes only to the
 * private spreadsheet below. Never expose the spreadsheet ID in the website.
 */
const CONFIG = {
  spreadsheetId: "1oqf2-40dY4MC79-cqTWHvQm2JjFR8GmNvD7YaZFxK8I",
  sheetName: "Sheet1",
  allowedOrigins: ["https://nantty.com", "https://www.nantty.com"],
  dailySubmissionLimit: 200,
  expectedHeaders: ["Submitted at", "Email", "Interest", "Consent"],
};

function doGet() {
  return ContentService.createTextOutput("Nantty waitlist intake is ready.");
}

function doPost(event) {
  const values = event && event.parameter ? event.parameter : {};
  const nonce = String(values.nonce || "").slice(0, 100);
  const requestedOrigin = String(values.origin || "");
  const targetOrigin = CONFIG.allowedOrigins.indexOf(requestedOrigin) >= 0 ? requestedOrigin : CONFIG.allowedOrigins[0];
  let status = "error";
  let message = "We could not save your request. Please try again later.";
  let lock;

  try {
    const email = String(values.email || "").trim().toLowerCase();
    const interest = String(values.interest || "");
    const consent = values.consent === "yes";
    const honeypot = String(values.website || "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(nonce)) throw new Error("Invalid request token");
    if (CONFIG.allowedOrigins.indexOf(requestedOrigin) === -1) throw new Error("Origin rejected");
    if (honeypot) throw new Error("Automated submission");
    if (!consent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Invalid submission");
    if (["buyer", "seller", "creator"].indexOf(interest) === -1) throw new Error("Invalid interest");

    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheetName);
    if (!sheet) throw new Error("Waitlist sheet missing");
    const headers = sheet.getRange(1, 1, 1, CONFIG.expectedHeaders.length).getDisplayValues()[0];
    if (headers.some(function (header, index) { return header !== CONFIG.expectedHeaders[index]; })) {
      throw new Error("Waitlist sheet columns do not match the intake contract");
    }

    const properties = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), "Etc/UTC", "yyyy-MM-dd");
    const dailyState = JSON.parse(properties.getProperty("dailySubmissionState") || "{}");
    const dailyCount = dailyState.date === today ? Number(dailyState.count || 0) : 0;
    if (dailyCount >= CONFIG.dailySubmissionLimit) {
      status = "error";
      message = "The waitlist is busy right now. Please try again tomorrow.";
    } else {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const existingEmails = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
        if (existingEmails.some(function (row) { return String(row[0]).trim().toLowerCase() === email; })) {
          status = "duplicate";
          message = "You are already on the list. Thanks for your interest.";
        }
      }
      if (status !== "duplicate") {
        // A leading apostrophe makes a user-supplied value literal in Sheets.
        sheet.appendRow([new Date(), "'" + email, interest, "yes"]);
        properties.setProperty("dailySubmissionState", JSON.stringify({ date: today, count: dailyCount + 1 }));
        status = "saved";
        message = "You are on the list. Thanks for your interest in Nantty.";
      }
    }
  } catch (error) {
    // Do not put submitted email addresses or other form values in execution logs.
    console.error("Waitlist submission rejected", error && error.message ? error.message : "unknown");
  } finally {
    if (lock) lock.releaseLock();
  }

  const payload = JSON.stringify({ type: "nantty-waitlist", nonce: nonce, status: status, message: message });
  const html = '<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' + payload + ', ' + JSON.stringify(targetOrigin) + ');</script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
