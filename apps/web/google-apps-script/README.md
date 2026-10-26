# Nantty waitlist → Google Sheets

The landing page stays on Nantty. When enabled, the browser submits a normal
HTML form into a hidden iframe; this Google Apps Script web app writes the
submission to a restricted Sheet and posts an inline result back to the page.
The Sheet ID stays in Apps Script and is never included in the static site.

## Before collecting any data

1. Create a Google Sheet owned by the business. Restrict sharing to the small
   group that needs the responses; do not publish the Sheet to the web.
2. Create a bound Apps Script project, copy `Code.gs`, set `spreadsheetId`, then
   run `setupWaitlistSheet` while signed in to the business account.
3. Confirm the final legal entity/contact, purpose, retention period, access,
   deletion and opt-out process in `/waitlist-privacy/`. Obtain legal/privacy
   approval before enabling collection.
4. Deploy as a web app executing as the owner and available to anyone. The
   endpoint is public by design; it accepts only allow-listed origins as a
   submitted field, validates input, uses a honeypot and serializes duplicate
   checks. These are spam controls, not strong authentication; monitor abuse.
5. Set `NEXT_PUBLIC_WAITLIST_APPS_SCRIPT_URL` to the deployment URL and
   `NEXT_PUBLIC_WAITLIST_ENABLED=true` for the static build. Keep the explicit
   enable flag false until the notice and Sheet controls are ready.
6. Rebuild and deploy the static site. Test new, duplicate, malformed, rejected
   origin, honeypot and unavailable-Sheet cases in a private test Sheet. Verify
   the browser stays on Nantty and reports success only after the response.

Do not put Google credentials, service-account keys, or the Sheet ID in
`NEXT_PUBLIC_*` values. The script currently stores only timestamp, email,
interest and consent marker; it does not capture an IP address. Set an explicit
retention schedule and deletion/opt-out procedure before launch.
