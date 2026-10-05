package revealpersonaldata

import (
	"context"
	"strings"
	"time"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	usersservices "zudomart/modules/users/src/services"
)

const revealWindowSeconds = 300

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	purpose := strings.TrimSpace(query.Purpose)
	if len(purpose) < 5 || len(purpose) > 300 {
		return Result{}, usersErrors.ValidationFailedFor("purpose", "must be 5 to 300 characters")
	}
	target, err := services.LoadTarget(ctx, handler.Container, query.TargetId)
	if err != nil {
		return Result{}, err
	}
	result := Result{LegalName: target.Account.Name, RevealedAt: handler.Container.Now().UTC().Format(time.RFC3339), ExpiresInSeconds: revealWindowSeconds}
	if target.Account.Email != nil {
		result.Email = *target.Account.Email
	}
	if target.Account.Birthday != nil {
		birthday := target.Account.Birthday.UTC().Format(time.DateOnly)
		result.DateOfBirth = &birthday
	}
	err = usersservices.RecordStaffAuditEntry(ctx, query.Actor, usersservices.StaffAuditEntry{
		Action: "user.personal_data_revealed", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: purpose,
		After: map[string]any{"fields": []string{"email", "phone", "legalName", "dateOfBirth"}},
	})
	return result, err
}
