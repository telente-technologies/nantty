package getownaccount

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffwebauthncredential"
	"zudomart/modules/admin/src/modules/staffAccount/models"
	"zudomart/modules/admin/src/modules/staffAccount/services"
	staffadminservices "zudomart/modules/admin/src/modules/staffAdmins/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.OwnAccountView, error) {
	staff, err := services.LoadActiveStaff(ctx, handler.Container.Client, query.StaffId)
	if err != nil {
		return models.OwnAccountView{}, err
	}
	view, err := staffadminservices.BuildSingleStaffView(ctx, handler.Container, staff)
	if err != nil {
		return models.OwnAccountView{}, err
	}
	rows, err := handler.Container.Client.StaffWebauthnCredential.Query().Where(staffwebauthncredential.StaffID(staff.ID)).
		Order(ent.Asc(staffwebauthncredential.FieldCreatedAt)).All(ctx)
	if err != nil {
		return models.OwnAccountView{}, err
	}
	passkeys := make([]models.PasskeyView, 0, len(rows))
	for _, row := range rows {
		passkeys = append(passkeys, models.ConvertPasskeyToView(row))
	}
	return models.OwnAccountView{
		Account: view, RecoveryCodesRemaining: len(staff.RecoveryCodeHashes), Passkeys: passkeys, Preferences: models.PreferencesView{Theme: string(staff.ThemePreference)},
	}, nil
}
