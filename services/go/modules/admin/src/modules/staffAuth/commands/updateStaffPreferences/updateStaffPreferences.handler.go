package updatestaffpreferences

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
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
