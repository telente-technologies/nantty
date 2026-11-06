# Push provider configuration

## Runtime modes

`PUSH_PROVIDER` defaults to `log`. In this mode the service records only a
token-free diagnostic log and marks the push delivery as `skipped` with
`push_provider_log_only`; it does not report a provider acceptance or external
delivery.

- `log`: no network call to Expo or FCM.
- `expo`: enable the existing Expo Push API for registrations whose
  `provider` is `expo`.
- `fcm`: enable Firebase Cloud Messaging HTTP v1 for `provider: "fcm"`.
- `multi`: enable both providers and route each registration to its provider.

Existing token-registration clients remain compatible: when `provider` is
omitted, the API and database default it to `expo`. FCM clients must register
`provider: "fcm"`. The provider is independent of `platform`.

When `PUSH_PROVIDER=fcm` or `PUSH_PROVIDER=multi`, set these values through the
deployment secret manager, not source files or client configuration:

- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL`
- `FCM_PRIVATE_KEY` (PKCS#8 PEM; escaped `\\n` line breaks are normalized)

The server signs a short-lived service-account assertion and exchanges it at
Google OAuth. Credentials and access tokens are never logged or persisted.
Provider response bodies are reduced to an allow-listed code before recording
failure metadata.

## Fan-out and pruning

The dispatcher and widget-refresh handler group a user's active registrations
by provider. Expo keeps its existing 100-message ticket batching. FCM sends
bounded parallel requests to the HTTP v1 endpoint. Only Expo
`DeviceNotRegistered` and FCM `UNREGISTERED` outcomes remove a registration;
invalid payload, credential, permission, rate-limit, network, and unknown
errors do not prune tokens. Failure records contain provider, classification,
normalized code, and counts, not raw token values or response prose.

Provider acceptance is not proof that an operating system displayed a push.
FCM or Expo external delivery is not verified by service unit tests. `log`
mode remains the default, and enabling a real provider requires deployment
configuration, credentials, and provider/device integration verification.

Automatic retries remain disabled; see `PUSH_RETRY_DESIGN.md` for the separate
durable retry requirements.
