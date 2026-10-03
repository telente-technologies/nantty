package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffsession"
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
	return checker.Container.Client.StaffSession.Query().Where(
		staffsession.ID(sessionUuid), staffsession.StaffID(staffUuid), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(checker.Container.Now()),
		staffsession.HasStaffWith(staffaccount.StatusEQ(staffaccount.StatusActive)),
	).Exist(ctx)
}
