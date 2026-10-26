package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffsession"
)

type StaffSessionChecker struct {
	Container *container.Container
}

func (checker StaffSessionChecker) IsStaffSessionActive(ctx context.Context, staffId, sessionId string) (bool, error) {
	staffUuid, staffErr := uuid.Parse(staffId)
	sessionUuid, sessionErr := uuid.Parse(sessionId)
	if staffErr != nil || sessionErr != nil {
		return false, nil
	}
	now := checker.Container.Now()
	active, err := checker.Container.Client.StaffSession.Query().Where(
		staffsession.ID(sessionUuid), staffsession.StaffID(staffUuid), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(now),
		staffsession.HasStaffWith(staffaccount.StatusEQ(staffaccount.StatusActive)),
	).Exist(ctx)
	if err != nil || !active {
		return active, err
	}
	_, err = checker.Container.Client.StaffSession.Update().
		Where(staffsession.ID(sessionUuid), staffsession.LastUsedAtLT(now.Add(-lastSeenRefreshInterval))).SetLastUsedAt(now).Save(ctx)
	return true, err
}

const lastSeenRefreshInterval = time.Minute
