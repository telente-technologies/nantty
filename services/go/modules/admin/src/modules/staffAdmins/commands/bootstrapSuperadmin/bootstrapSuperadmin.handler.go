package bootstrapsuperadmin

import (
	"context"
	"strings"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/repositories"
	"nantty/modules/admin/src/types"
	secrettokens "nantty/modules/admin/src/utils/secretTokens"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (string, error) {
	email, valid := secrettokens.NormalizeStaffEmail(command.Email)
	if !valid {
		return "", adminerrors.Unprocessable("Enter a valid email address.")
	}
	if err := secrettokens.AssertStaffPasswordMeetsPolicy(command.Password, email, command.DisplayName); err != nil {
		return "", err
	}
	passwordHash, err := handler.Container.Passwords.HashPasswordWithArgon2id(command.Password)
	if err != nil {
		return "", err
	}
	var createdId string
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if taken, err := tx.StaffAccount.Query().Where(staffaccount.Email(email)).Exist(ctx); err != nil || taken {
			return adminerrors.FirstError(err, adminerrors.EmailAlreadyInUse)
		}
		created, err := tx.StaffAccount.Create().SetEmail(email).SetDisplayName(types.TruncateToLength(strings.TrimSpace(command.DisplayName), 80)).
			SetRole(staffaccount.RoleSuperadmin).SetPasswordHash(passwordHash).SetStatus(staffaccount.StatusActive).Save(ctx)
		if err != nil {
			return err
		}
		createdId = created.ID.String()
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: "cli", ActorRole: "system", Action: "staff.superadmin_bootstrapped", SubjectType: "staff", SubjectId: createdId,
		})
	})
	return createdId, err
}
