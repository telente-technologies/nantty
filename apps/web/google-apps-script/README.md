# Nantty waitlist → Google Sheets

The landing page stays on Nantty. When enabled, the browser submits a normal
HTML form into a hidden iframe; Google Apps Script writes the request to a
restricted Sheet and posts an inline result back to the page. The Sheet ID is
kept in Apps Script and is never included in the static site.

## Before collecting any data

1. Keep the waitlist spreadsheet private and restrict access to the people who
   need the responses. Do not publish the Sheet to the web.
2. In the business-owned Apps Script project, copy `Code.gs` and set the Script
   Property `SPREADSHEET_ID` to the private waitlist spreadsheet ID. Run
   `setupWaitlistSheet` while signed in to the business account. It extends the
   existing four-column header without deleting rows and fails closed if it
   finds an unexpected schema.
3. Review `/waitlist-privacy/` against the fields in `Code.gs`, including the
   optional seller details, separate marketing choice, retention, access,
   deletion, and opt-out process. Obtain required privacy/legal approval before
   enabling the expanded seller intake.
   Run the local Apps Script contract tests with `node --test Code.test.cjs`.
4. Deploy the updated script as a new version of the existing web app, executing
   as the owner and available to anyone. Keep the existing deployment URL if
   possible. The endpoint is public by design; it allow-lists origins, validates
   inputs, uses a honeypot, and serializes duplicate checks. These are spam
   controls, not strong authentication; monitor abuse.
5. Set `NEXT_PUBLIC_WAITLIST_APPS_SCRIPT_URL` to the deployed endpoint and
   `NEXT_PUBLIC_WAITLIST_ENABLED=true` for the static build. Keep the enable flag
   false until the notice, script, and Sheet schema are ready.
6. Rebuild and deploy the static site. Test new, duplicate, malformed, rejected
   origin, honeypot, and unavailable-Sheet cases in a private test Sheet. Verify
   the browser stays on Nantty and reports success only after the response.

The form collects email, interest, a required waitlist-processing acknowledgement,
and an optional launch-update preference. Only people choosing seller/business
see the optional seller questions: name, business name, phone/WhatsApp, product
category, sales channels, approximate monthly sales, planned product count,
founding-seller beta interest, and expected listing timing. Buyer and creator
records leave those seller fields blank. The script does not collect IP addresses.
Marketing updates are separate and are not required to join the waitlist.

Imported legacy seller responses are marked historical. Their prior beta
acknowledgement is not treated as marketing consent. Do not send marketing email
to those records unless current consent is obtained. Never put Google
credentials, service-account keys, or the Sheet ID in `NEXT_PUBLIC_*` values.
