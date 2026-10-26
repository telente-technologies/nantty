package services

import (
	"nantty/modules/users/src/errors"
	"nantty/modules/users/src/types"
)

func RequireSuperadmin(actor types.StaffActor) error {
	if actor.Role != "superadmin" {
		return errors.Forbidden("SUPERADMIN_REQUIRED", "Only a superadmin can do that.")
	}
	return nil
}

func RequireSuperadminForBlack(actor types.StaffActor, color string) error {
	if color == "black" && actor.Role != "superadmin" {
		return errors.Forbidden("BLACK_ADMIN_ONLY", "Only a superadmin can grant or revoke the Black checkmark.")
	}
	return nil
}
