package beginpasskeysignin

import (
	"context"
	"encoding/json"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffloginchallenge"
	"zudomart/modules/admin/src/modules/staffAuth/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (json.RawMessage, error) {
	service := services.StaffAuthService{Container: handler.Container}
	var options json.RawMessage
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		challenge, err := service.FindUsableChallengeInTransaction(ctx, tx, command.ChallengeToken, staffloginchallenge.PurposeLogin)
		if err != nil {
			return err
		}
		staff, err := tx.StaffAccount.Query().Where(staffaccount.ID(challenge.StaffID), staffaccount.StatusEQ(staffaccount.StatusActive)).Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.InvalidChallenge
		}
		if err != nil {
			return err
		}
		encodedOptions, session, err := service.BeginPasskeyAssertion(ctx, tx.Client(), staff)
		if err != nil {
			return err
		}
		options = encodedOptions
		return challenge.Update().SetWebauthnSession(session).Exec(ctx)
	})
	return options, err
}
