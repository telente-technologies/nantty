package getownaccount

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffwebauthncredential"
	"nantty/modules/admin/src/modules/staffAccount/models"
	"nantty/modules/admin/src/modules/staffAccount/services"
	staffadminservices "nantty/modules/admin/src/modules/staffAdmins/services"
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
