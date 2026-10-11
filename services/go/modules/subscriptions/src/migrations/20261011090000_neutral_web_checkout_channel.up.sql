-- Flutterwave is the only provider: rename the old provider-specific web channel to the neutral value.
UPDATE "subscriptions" SET "channel" = 'web_checkout' WHERE "channel" NOT IN ('web_checkout', 'apple_iap', 'google_play', 'admin_grant');
