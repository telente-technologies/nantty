package integrations

import (
	"context"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"nantty/modules/live/src/modules/sessions/announcements"
)

func (relations SchemaSocialRelations) LookupSpaceAnnouncement(ctx context.Context, postID uuid.UUID) (announcements.Post, error) {
	var post announcements.Post
	query := `SELECT "authorId"::text, "text" FROM ` + pgx.Identifier{relations.SocialSchema, "posts"}.Sanitize() + ` WHERE id = $1 AND kind = 'post' AND "deletedAt" IS NULL AND "moderationVisibility" = 'visible' AND audience = 'everyone' AND visibility = 'public' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)`
	err := relations.Database.QueryRowContext(ctx, query, postID).Scan(&post.AuthorID, &post.Text)
	return post, err
}
