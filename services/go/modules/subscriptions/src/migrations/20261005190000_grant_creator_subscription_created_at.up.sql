-- let live count new subscribers per stream
GRANT SELECT ("created_at") ON "creator_subscriptions" TO nantty_readers;
