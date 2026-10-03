package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
	"zudomart/modules/admin/internal/ent/staffsession"
)

func (application *AdminApplication) LogOutStaffSession(ctx context.Context, staffId, sessionId string) error {
	staffUuid, staffErr := uuid.Parse(staffId)
	sessionUuid, sessionErr := uuid.Parse(sessionId)
	if staffErr != nil || sessionErr != nil {
		return errInvalidRefreshToken
	}
	_, err := application.Client.StaffSession.Update().Where(staffsession.ID(sessionUuid), staffsession.StaffID(staffUuid), staffsession.RevokedAtIsNil()).
		SetRevokedAt(application.Now()).Save(ctx)
	return err
}

func (application *AdminApplication) GetCurrentStaffWithLiveSession(ctx context.Context, staffId, sessionId string) (StaffView, error) {
	staffUuid, staffErr := uuid.Parse(staffId)
	sessionUuid, sessionErr := uuid.Parse(sessionId)
	if staffErr != nil || sessionErr != nil {
		return StaffView{}, errInvalidRefreshToken
	}
	live, err := application.Client.StaffSession.Query().Where(staffsession.ID(sessionUuid), staffsession.StaffID(staffUuid), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(application.Now())).Exist(ctx)
	if err != nil || !live {
		return StaffView{}, firstError(err, errInvalidRefreshToken)
	}
	staff, err := application.Client.StaffAccount.Query().Where(staffaccount.ID(staffUuid), staffaccount.StatusEQ(staffaccount.StatusActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return StaffView{}, errInvalidRefreshToken
	}
	if err != nil {
		return StaffView{}, err
	}
	return ConvertStaffToView(staff), nil
}

func firstError(err error, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}
