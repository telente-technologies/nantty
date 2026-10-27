GRANT SELECT ("createdAt") ON "follows" TO nantty_readers;
GRANT SELECT ("id", "authorId", "deletedAt") ON "posts" TO nantty_readers;
GRANT SELECT ("postId", "day", "impressions") ON "post_daily_stats" TO nantty_readers;
