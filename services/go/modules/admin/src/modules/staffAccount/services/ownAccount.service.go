package services

import (
	"context"

	"github.com/google/uuid"

	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/repositories"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

func LoadActiveStaff(ctx context.Context, client *ent.Client, staffId string) (*ent.StaffAccount, error) {
	identifier, err := uuid.Parse(staffId)
	if err != nil {
		return nil, adminerrors.InvalidRefreshToken
	}
	staff, err := client.StaffAccount.Query().Where(staffaccount.ID(identifier), staffaccount.StatusEQ(staffaccount.StatusActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adminerrors.InvalidRefreshToken
	}
	return staff, err
}

func RecordOwnAccountChange(ctx context.Context, tx *ent.Tx, actor staffauth.Staff, staff *ent.StaffAccount, action string, before, after any) error {
	event := identityports.AuditEvent{
		ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: action, SubjectType: "staff", SubjectId: staff.ID.String(), SubjectLabel: staff.Email,
		StepUpVerified: actor.SteppedUp,
	}
	if before != nil {
		event.Before = jsonencoding.MustMarshalJson(before)
	}
	if after != nil {
		event.After = jsonencoding.MustMarshalJson(after)
	}
	return repositories.RecordAuditEventInTransaction(ctx, tx, event)
}
