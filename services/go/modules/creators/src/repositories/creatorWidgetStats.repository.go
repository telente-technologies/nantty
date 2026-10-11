package repositories

import (
	"context"
	"time"
)

type CreatorWidgetStatsReader interface {
	FollowersGainedSince(ctx context.Context, accountId string, since time.Time) (int64, error)
	ContentViewsOnDay(ctx context.Context, accountId string, day string) (int64, error)
}

func (directory SqlCreatorsDirectory) FollowersGainedSince(ctx context.Context, accountId string, since time.Time) (int64, error) {
	var count int64
	err := directory.Database.QueryRowContext(ctx, `SELECT COUNT(*) FROM `+directory.table(directory.SocialSchema, "follows")+
		` WHERE "followeeId"::text = $1 AND state = 'accepted' AND "createdAt" >= $2`, accountId, since).Scan(&count)
	if err != nil && directory.unreadable(err) {
		return 0, nil
	}
	return count, err
}

func (directory SqlCreatorsDirectory) ContentViewsOnDay(ctx context.Context, accountId string, day string) (int64, error) {
	var views int64
	err := directory.Database.QueryRowContext(ctx, `SELECT COALESCE(SUM(stats.impressions), 0) FROM `+directory.table(directory.SocialSchema, "post_daily_stats")+` stats JOIN `+
		directory.table(directory.SocialSchema, "posts")+` post ON post.id = stats."postId" WHERE post."authorId"::text = $1 AND post."deletedAt" IS NULL AND stats.day = $2`, accountId, day).Scan(&views)
	if err != nil && directory.unreadable(err) {
		return 0, nil
	}
	return views, err
}

func (directory StaticCreatorsDirectory) FollowersGainedSince(_ context.Context, accountId string, _ time.Time) (int64, error) {
	return directory.Followers[accountId], nil
}

func (directory StaticCreatorsDirectory) ContentViewsOnDay(context.Context, string, string) (int64, error) {
	return 0, nil
}
