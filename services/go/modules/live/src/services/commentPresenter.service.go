package services

import (
	"context"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livecomment"
	"nantty/modules/live/src/types"
)

func decodeStoredMentions(stored []map[string]any) []types.CommentMentionView {
	views := make([]types.CommentMentionView, 0, len(stored))
	for _, item := range stored {
		userId, _ := item["userId"].(string)
		username, _ := item["username"].(string)
		start, _ := item["start"].(float64)
		length, _ := item["length"].(float64)
		views = append(views, types.CommentMentionView{UserId: userId, Username: username, Start: int(start), Length: int(length)})
	}
	return views
}

func (service *LiveService) presentComments(ctx context.Context, rows []*ent.LiveComment, pinnedId *uuid.UUID) ([]types.LiveCommentView, error) {
	authorIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		authorIds = append(authorIds, row.AuthorID)
	}
	participants, err := service.lookupParticipants(ctx, authorIds...)
	if err != nil {
		return nil, err
	}
	views := make([]types.LiveCommentView, 0, len(rows))
	for _, row := range rows {
		views = append(views, types.LiveCommentView{
			Id: row.ID.String(), LiveId: row.LiveID.String(), Author: summarise(participants[row.AuthorID]), Text: row.Body, Kind: "comment",
			CreatedAt: formatTime(row.CreatedAt), Mentions: decodeStoredMentions(row.Mentions), ReplyToId: formatOptionalUuid(row.ReplyToID),
			Pinned: pinnedId != nil && *pinnedId == row.ID,
		})
	}
	return views, nil
}

func (service *LiveService) presentComment(ctx context.Context, row *ent.LiveComment, pinnedId *uuid.UUID) (types.LiveCommentView, error) {
	views, err := service.presentComments(ctx, []*ent.LiveComment{row}, pinnedId)
	if err != nil {
		return types.LiveCommentView{}, err
	}
	return views[0], nil
}

func (service *LiveService) loadCommentView(ctx context.Context, liveId, commentId uuid.UUID, pinnedId *uuid.UUID) (*types.LiveCommentView, error) {
	row, err := service.Client.LiveComment.Query().Where(livecomment.ID(commentId), livecomment.LiveID(liveId), livecomment.DeletedAtIsNil()).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	view, err := service.presentComment(ctx, row, pinnedId)
	return &view, err
}

func (service *LiveService) requireStaffRole(ctx context.Context, actor types.Actor, liveId uuid.UUID) (*ent.LiveSession, string, error) {
	session, role, err := service.loadLiveForStaff(ctx, actor, liveId)
	if err != nil {
		return nil, "", err
	}
	if role == RoleViewer && !actor.HasRole("admin") {
		return nil, "", liveerrors.NotLiveModerator
	}
	return session, role, nil
}
