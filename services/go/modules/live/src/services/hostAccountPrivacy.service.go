package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
)

func (service *LiveService) hostHiddenByPrivateAccount(ctx context.Context, hostId, viewer uuid.UUID) (bool, error) {
	if viewer == hostId {
		return false, nil
	}
	private, err := service.Relations.PrivateAccountsAmong(ctx, []uuid.UUID{hostId})
	if err != nil || !private[hostId] {
		return false, err
	}
	if viewer == uuid.Nil {
		return true, nil
	}
	following, err := service.Relations.IsFollowing(ctx, viewer, hostId)
	return !following, err
}

func (service *LiveService) withoutLivesOfPrivateHostsHiddenFrom(ctx context.Context, viewer uuid.UUID, sessions []*ent.LiveSession) ([]*ent.LiveSession, error) {
	hostIds := make([]uuid.UUID, 0, len(sessions))
	for _, session := range sessions {
		hostIds = append(hostIds, session.HostID)
	}
	private, err := service.Relations.PrivateAccountsAmong(ctx, hostIds)
	if err != nil || len(private) == 0 {
		return sessions, err
	}
	followed := map[uuid.UUID]bool{}
	if viewer != uuid.Nil {
		if followed, err = service.Relations.FollowedAmong(ctx, viewer, hostIds); err != nil {
			return nil, err
		}
	}
	visible := make([]*ent.LiveSession, 0, len(sessions))
	for _, session := range sessions {
		if !private[session.HostID] || followed[session.HostID] || session.HostID == viewer {
			visible = append(visible, session)
		}
	}
	return visible, nil
}
