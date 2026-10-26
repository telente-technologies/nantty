package services

import (
	"strings"

	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/generated/ent"
)

func MapUniqueViolationToConflict(err error) error {
	if !ent.IsConstraintError(err) {
		return err
	}
	if strings.Contains(err.Error(), "username") {
		return authErrors.ErrUsernameAlreadyInUse
	}
	return authErrors.ErrEmailAlreadyInUse
}

func FirstError(err error, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}
