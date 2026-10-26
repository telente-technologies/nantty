package getcurrentstaff

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffsession"
	staffadminservices "nantty/modules/admin/src/modules/staffAdmins/services"
	"nantty/modules/admin/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.StaffView, error) {
	staffId, staffErr := uuid.Parse(query.StaffId)
	sessionId, sessionErr := uuid.Parse(query.SessionId)
	if staffErr != nil || sessionErr != nil {
		return types.StaffView{}, adminerrors.InvalidRefreshToken
	}
	live, err := handler.Container.Client.StaffSession.Query().
		Where(staffsession.ID(sessionId), staffsession.StaffID(staffId), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(handler.Container.Now())).Exist(ctx)
	if err != nil || !live {
		return types.StaffView{}, adminerrors.FirstError(err, adminerrors.InvalidRefreshToken)
	}
	staff, err := handler.Container.Client.StaffAccount.Query().Where(staffaccount.ID(staffId), staffaccount.StatusEQ(staffaccount.StatusActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.StaffView{}, adminerrors.InvalidRefreshToken
	}
	if err != nil {
		return types.StaffView{}, err
	}
	return staffadminservices.BuildSingleStaffView(ctx, handler.Container, staff)
}
