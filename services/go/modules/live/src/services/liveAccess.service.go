package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/battle"
	"zudomart/modules/live/src/generated/ent/livemoderator"
	"zudomart/modules/live/src/generated/ent/liverestriction"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/types"
)

const (
	RoleHost      = "host"
	RoleModerator = "moderator"
	RoleViewer    = "viewer"
)

type AccessDecision struct {
	Allowed bool
	Reason  string
	Role    string
}

func (service *LiveService) roleInLive(ctx context.Context, session *ent.LiveSession, userId uuid.UUID) (string, error) {
	if session.HostID == userId {
		return RoleHost, nil
	}
	moderator, err := service.Client.LiveModerator.Query().Where(livemoderator.LiveID(session.ID), livemoderator.UserID(userId)).Exist(ctx)
	if err != nil {
		return "", err
	}
	if moderator {
		return RoleModerator, nil
	}
	return RoleViewer, nil
}

func (service *LiveService) activeRestriction(ctx context.Context, liveId, userId uuid.UUID, kind liverestriction.Kind) (*ent.LiveRestriction, error) {
	restriction, err := service.Client.LiveRestriction.Query().Where(
		liverestriction.LiveID(liveId), liverestriction.UserID(userId), liverestriction.KindEQ(kind),
		liverestriction.Or(liverestriction.ExpiresAtIsNil(), liverestriction.ExpiresAtGT(service.Now())),
	).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return restriction, err
}

func (service *LiveService) DecideLiveAccess(ctx context.Context, session *ent.LiveSession, userId uuid.UUID) (AccessDecision, error) {
	role, err := service.roleInLive(ctx, session, userId)
	if err != nil || role != RoleViewer {
		return AccessDecision{Allowed: err == nil, Reason: "allowed", Role: role}, err
	}
	deny := func(reason string) (AccessDecision, error) { return AccessDecision{Reason: reason, Role: role}, nil }
	if banned, err := service.activeRestriction(ctx, session.ID, userId, liverestriction.KindBanned); err != nil || banned != nil {
		return orDenied(err, "banned", role)
	}
	blocked, err := service.Relations.BlockedEitherWay(ctx, userId, []uuid.UUID{session.HostID})
	if err != nil {
		return AccessDecision{}, err
	}
	if blocked[session.HostID] {
		return deny("blocked")
	}
	switch session.Visibility {
	case livesession.VisibilityFollowers:
		following, err := service.Relations.IsFollowing(ctx, userId, session.HostID)
		if err != nil || !following {
			return orDenied(err, "followersOnly", role)
		}
	case livesession.VisibilitySubscribers:
		subscribed, err := service.Relations.IsActiveSubscriber(ctx, userId, session.HostID)
		if err != nil || !subscribed {
			return orDenied(err, "subscribersOnly", role)
		}
	}
	return AccessDecision{Allowed: true, Reason: "allowed", Role: role}, nil
}

func orDenied(err error, reason, role string) (AccessDecision, error) {
	if err != nil {
		return AccessDecision{}, err
	}
	return AccessDecision{Reason: reason, Role: role}, nil
}

func (service *LiveService) DecideTopicAccess(ctx context.Context, userId uuid.UUID, topic string) (types.TopicAccessView, error) {
	kind, rawIdentifier, found := strings.Cut(topic, ":")
	identifier, parseErr := uuid.Parse(rawIdentifier)
	if !found || parseErr != nil || (kind != "live" && kind != "battle") {
		return types.TopicAccessView{Reason: "unknownTopic"}, nil
	}
	liveId := identifier
	if kind == "battle" {
		row, err := service.Client.Battle.Query().Where(battle.ID(identifier)).Only(ctx)
		if ent.IsNotFound(err) {
			return types.TopicAccessView{Reason: "notFound"}, nil
		}
		if err != nil {
			return types.TopicAccessView{}, err
		}
		liveId = row.LiveID
	}
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return types.TopicAccessView{Reason: "notFound"}, nil
	}
	if err != nil {
		return types.TopicAccessView{}, err
	}
	decision, err := service.DecideLiveAccess(ctx, session, userId)
	if err != nil {
		return types.TopicAccessView{}, err
	}
	return types.TopicAccessView{Allowed: decision.Allowed, Reason: decision.Reason, Role: decision.Role, LiveId: liveId.String()}, nil
}

func expiryOrNil(expiresAt *time.Time) *string { return formatOptionalTime(expiresAt) }

func (service *LiveService) requireLiveAccess(ctx context.Context, session *ent.LiveSession, userId uuid.UUID) error {
	decision, err := service.DecideLiveAccess(ctx, session, userId)
	if err != nil {
		return err
	}
	if decision.Allowed {
		return nil
	}
	if decision.Reason == "banned" {
		return liveerrors.ViewerBanned
	}
	return liveerrors.LiveNotAccessible
}
