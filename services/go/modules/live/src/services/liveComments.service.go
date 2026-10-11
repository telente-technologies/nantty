package services

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"

	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livecomment"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/types"
)

type commentGate struct {
	session  *ent.LiveSession
	role     string
	settings roomSettings
}

func (service *LiveService) openCommentGate(ctx context.Context, actor types.Actor, liveId uuid.UUID) (commentGate, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return commentGate{}, liveerrors.LiveNotFound
	}
	if err != nil {
		return commentGate{}, err
	}
	decision, err := service.DecideLiveAccess(ctx, session, actor.UserId)
	if err != nil {
		return commentGate{}, err
	}
	if !decision.Allowed {
		if decision.Reason == "banned" {
			return commentGate{}, liveerrors.ViewerBanned
		}
		return commentGate{}, liveerrors.LiveNotAccessible
	}
	settings, err := service.loadRoomSettings(ctx, liveId)
	return commentGate{session: session, role: decision.Role, settings: settings}, err
}

func (service *LiveService) activeMute(ctx context.Context, liveId, userId uuid.UUID) (*ent.LiveRestriction, error) {
	return service.activeRestriction(ctx, liveId, userId, "muted")
}

func (service *LiveService) PostLiveComment(ctx context.Context, actor types.Actor, liveId uuid.UUID, input types.PostLiveCommentInput) (types.LiveCommentView, error) {
	text, err := NormaliseCommentText(input.Text)
	if err != nil {
		return types.LiveCommentView{}, err
	}
	gate, err := service.openCommentGate(ctx, actor, liveId)
	if err != nil {
		return types.LiveCommentView{}, err
	}
	if gate.session.State != livesession.StateLive {
		return types.LiveCommentView{}, liveerrors.LiveNotActive
	}
	isStaff := gate.role != RoleViewer
	if !gate.settings.CommentsEnabled && gate.role != RoleHost {
		return types.LiveCommentView{}, liveerrors.CommentsDisabled
	}
	if !isStaff {
		if err := service.rejectUnlessViewerMayComment(ctx, gate.session, actor.UserId, text, gate.settings); err != nil {
			return types.LiveCommentView{}, err
		}
	}
	replyTo, err := service.validateReplyTarget(ctx, liveId, input.ReplyToId)
	if err != nil {
		return types.LiveCommentView{}, err
	}
	mentions, err := service.ResolveCommentMentions(ctx, actor.UserId, text, input.Mentions)
	if err != nil {
		return types.LiveCommentView{}, err
	}
	return service.insertComment(ctx, actor, gate, text, replyTo, mentions)
}

func (service *LiveService) rejectUnlessViewerMayComment(ctx context.Context, session *ent.LiveSession, userId uuid.UUID, text string, settings roomSettings) error {
	if muted, err := service.activeMute(ctx, session.ID, userId); err != nil || muted != nil {
		return orRestriction(err, liveerrors.ViewerMuted)
	}
	switch settings.CommentAudience {
	case CommentAudienceFollowers:
		if following, err := service.Relations.IsFollowing(ctx, userId, session.HostID); err != nil || !following {
			return orRestriction(err, liveerrors.CommentsFollowersOnly)
		}
	case CommentAudienceSubscribers:
		if subscribed, err := service.Relations.IsActiveSubscriber(ctx, userId, session.HostID); err != nil || !subscribed {
			return orRestriction(err, liveerrors.CommentsSubscribersOnly)
		}
	}
	if _, blockedWord := FindBlockedWord(text, service.Settings.PlatformBlockedWords, settings.BlockedWords); blockedWord {
		return liveerrors.CommentBlockedWord
	}
	return nil
}

func orRestriction(err error, restriction error) error {
	if err != nil {
		return err
	}
	return restriction
}

func (service *LiveService) validateReplyTarget(ctx context.Context, liveId uuid.UUID, rawReplyTo string) (*uuid.UUID, error) {
	if rawReplyTo == "" {
		return nil, nil
	}
	replyToId, err := uuid.Parse(rawReplyTo)
	if err != nil {
		return nil, liveerrors.CommentNotFound
	}
	exists, err := service.Client.LiveComment.Query().Where(livecomment.ID(replyToId), livecomment.LiveID(liveId), livecomment.DeletedAtIsNil()).Exist(ctx)
	if err != nil || !exists {
		return nil, orRestriction(err, liveerrors.CommentNotFound)
	}
	return &replyToId, nil
}

func (service *LiveService) insertComment(ctx context.Context, actor types.Actor, gate commentGate, text string, replyTo *uuid.UUID, mentions ResolvedMentions) (types.LiveCommentView, error) {
	var created *ent.LiveComment
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", fmt.Sprintf("comment:%s:%s", gate.session.ID, actor.UserId)); err != nil {
			return err
		}
		if gate.role == RoleViewer {
			if err := service.enforceCommentGap(ctx, tx, gate.session.ID, actor.UserId, gate.settings.SlowModeSeconds); err != nil {
				return err
			}
		}
		now := service.Now()
		builder := tx.LiveComment.Create().SetCreatedAt(now).SetLiveID(gate.session.ID).SetAuthorID(actor.UserId).SetBody(text).SetMentions(mentions.Persisted).SetNillableReplyToID(replyTo)
		var err error
		if created, err = builder.Save(ctx); err != nil {
			return err
		}
		view, err := service.presentComment(ctx, created, nil)
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveCommentCreated, gate.session.ID.String(), now, events.LiveCommentCreatedEventData{
			LiveId: gate.session.ID.String(), Comment: view, MentionedUserIds: append([]string{}, mentions.Notify...),
		})
	})
	if err != nil {
		return types.LiveCommentView{}, err
	}
	return service.presentComment(ctx, created, gate.settings.PinnedCommentId)
}

func (service *LiveService) enforceCommentGap(ctx context.Context, tx *ent.Tx, liveId, authorId uuid.UUID, slowModeSeconds int) error {
	last, err := tx.LiveComment.Query().Where(livecomment.LiveID(liveId), livecomment.AuthorID(authorId)).Order(ent.Desc(livecomment.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if SlowModeWaitRemaining(last.CreatedAt, service.Now(), slowModeSeconds) > 0 {
		return liveerrors.SlowMode()
	}
	return nil
}

func (service *LiveService) ListLiveComments(ctx context.Context, actor types.Actor, liveId uuid.UUID, cursor string, limit int, oldestFirst bool) ([]types.LiveCommentView, string, error) {
	gate, err := service.openCommentGate(ctx, actor, liveId)
	if err != nil {
		return nil, "", err
	}
	query := service.Client.LiveComment.Query().Where(livecomment.LiveID(liveId), livecomment.DeletedAtIsNil()).Order(ent.Desc(livecomment.FieldID)).Limit(limit + 1)
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return nil, "", liveerrors.Unprocessable("CURSOR_INVALID", "That page cursor is not valid.")
		}
		query.Where(livecomment.IDLT(cursorId))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return nil, "", err
	}
	nextCursor := ""
	if len(rows) > limit {
		rows = rows[:limit]
		nextCursor = rows[len(rows)-1].ID.String()
	}
	views, err := service.presentComments(ctx, rows, gate.settings.PinnedCommentId)
	if oldestFirst {
		slices.Reverse(views)
	}
	return views, nextCursor, err
}
