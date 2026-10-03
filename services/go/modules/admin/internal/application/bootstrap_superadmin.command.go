package application

import (
	"context"
	"strings"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
	"zudomart/platform/identityports"
)

func (application *AdminApplication) BootstrapSuperadminFromCommandLine(ctx context.Context, rawEmail, displayName, password string) (string, error) {
	email, valid := NormalizeStaffEmail(rawEmail)
	if !valid {
		return "", unprocessable("Enter a valid email address.")
	}
	if err := AssertStaffPasswordMeetsPolicy(password); err != nil {
		return "", err
	}
	passwordHash, err := application.Passwords.HashPasswordWithArgon2id(password)
	if err != nil {
		return "", err
	}
	var createdId string
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if taken, err := tx.StaffAccount.Query().Where(staffaccount.Email(email)).Exist(ctx); err != nil || taken {
			return firstError(err, errEmailAlreadyInUse)
		}
		created, err := tx.StaffAccount.Create().SetEmail(email).SetDisplayName(truncateToLength(strings.TrimSpace(displayName), 80)).
			SetRole(staffaccount.RoleSuperadmin).SetPasswordHash(passwordHash).SetStatus(staffaccount.StatusActive).Save(ctx)
		if err != nil {
			return err
		}
		createdId = created.ID.String()
		return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: "cli", ActorRole: "system", Action: "staff.superadmin_bootstrapped", SubjectType: "staff", SubjectId: createdId,
		})
	})
	return createdId, err
}
