# Messenger device authorization API

All routes below are under `/api/v1/auth/messenger`. The existing `POST /api/v1/auth/login` contract is unchanged.

## Password login

`POST /authorizations` accepts `{ "identifier": string, "password": string, "platform": "android"|"ios", "deviceName": string, "installationId": string, "trustedDeviceToken"?: string }`.

An untrusted installation receives HTTP `202` and no session token:

```json
{
  "authorizationId": "<uuid>",
  "proof": "<high-entropy-secret>",
  "status": "pending",
  "expiresAt": "<RFC3339>",
  "methods": ["approve", "code", "email_recovery"],
  "device": {
    "name": "Pixel 9",
    "platform": "android",
    "requestedAt": "<RFC3339>",
    "approximateLocation": null
  }
}
```

`proof` must be stored as a secret. Never put it in a URL, analytics, logs, or notification payload. The API currently has no trusted IP-geolocation source; location is explicitly `null`. A matching unexpired trusted-device token plus the same installation ID returns HTTP `200` with an ordinary auth-session response and rotated `trustedDevice` credentials.

## Main Nantty app: pending request management

`GET /authorizations` requires an existing Nantty access token. It returns up to 50 unexpired pending requests belonging to that account:

```json
{
  "authorizations": [
    {
      "id": "<uuid>",
      "status": "pending",
      "device": { "name": "Pixel 9", "platform": "android", "requestedAt": "<RFC3339>", "approximateLocation": null },
      "expiresAt": "<RFC3339>"
    }
  ]
}
```

`POST /authorizations/{authorizationId}/approve` and `/deny` require an existing Nantty access token and an empty JSON object `{}` (or no body). Success is HTTP `204`. Approval does not issue Messenger tokens; the requesting installation must still call `/complete` with its proof.

`POST /authorizations/{authorizationId}/code` requires an existing Nantty access token and an empty JSON object `{}` (or no body). It returns HTTP `200` `{ "authorizationId": "<uuid>", "code": "<6 digits>", "expiresAt": "<RFC3339>" }`. This is the short-lived code to enter in Messenger.

## Messenger status, code, recovery, and completion

For all these routes, send `Authorization: Bearer <proof>`; the proof is never accepted in query parameters.

- `GET /authorizations/{authorizationId}` → HTTP `200` `{ "status": "pending|approved|denied|completed|expired", "expiresAt": "<RFC3339>", "device": { "name", "platform", "requestedAt", "approximateLocation" } }`.
- `POST /authorizations/{authorizationId}/verify-code` with `{ "code": "<6 digits>" }` → HTTP `200` `{ "status": "approved" }`.
- `POST /authorizations/{authorizationId}/recovery/email` with `{}` → HTTP `202` `{ "status": "sent", "destinationHint": "a***@example.com", "expiresIn": <seconds> }`. It sends the existing login-purpose OTP only to the account's verified email.
- `POST /authorizations/{authorizationId}/recovery/verify` with `{ "code": "<6 digits>" }` → HTTP `200` `{ "status": "approved" }`. It consumes the existing one-time verified-destination token internally, binds it to this proof-bound authorization, and never returns that token.
- `POST /authorizations/{authorizationId}/complete` with `{}` or no body → HTTP `200` ordinary auth-session JSON plus `trustedDevice: { "id", "token", "expiresAt" }`. Completion is single-use; no access to conversations is granted before this call succeeds.

Recovery availability is intentionally limited to active accounts with a verified email. Existing `/api/v1/auth/otp/send`, `/verify`, and `/api/v1/auth/password/reset` remain the normal account-recovery path; Messenger recovery does not reset passwords or create a standalone session.

## Trusted device management

- `GET /api/v1/auth/messenger/devices` requires a Nantty access token and returns `{ "devices": [{ "id", "platform", "deviceName", "createdAt", "lastUsedAt", "expiresAt" }] }`.
- `DELETE /api/v1/auth/messenger/devices/{deviceId}` requires a Nantty access token and returns `204`; it revokes the trusted credential and active sessions associated with that installation.

The authorization-request outbox event `messenger.loginApprovalRequested` maps to an auth inbox/push notification that opens the security screen and carries `authorizationId` plus `actions: ["approve", "deny"]`. The app must invoke the authenticated decision routes; notification metadata is not itself an authorization capability.
