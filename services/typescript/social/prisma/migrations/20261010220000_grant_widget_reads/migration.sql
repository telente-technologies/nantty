GRANT SELECT ("createdAt") ON "follows" TO zudomart_readers;
GRANT SELECT ("id", "authorId", "deletedAt") ON "posts" TO zudomart_readers;
GRANT SELECT ("postId", "day", "impressions") ON "post_daily_stats" TO zudomart_readers;
