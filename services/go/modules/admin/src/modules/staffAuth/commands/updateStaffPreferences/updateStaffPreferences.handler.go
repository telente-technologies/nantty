package updatestaffpreferences

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	staffId, err := uuid.Parse(command.StaffId)
	if err != nil {
		return adminerrors.StaffNotFound
	}
	err = handler.Container.Client.StaffAccount.UpdateOneID(staffId).Where(staffaccount.StatusEQ(staffaccount.StatusActive)).
		SetThemePreference(staffaccount.ThemePreference(command.Theme)).Exec(ctx)
	if ent.IsNotFound(err) {
		return adminerrors.StaffNotFound
	}
	return err
}
