package beginpasskeystepup

import (
	"context"
	"encoding/json"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffsession"
	"nantty/modules/admin/src/modules/staffAuth/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (json.RawMessage, error) {
	service := services.StaffAuthService{Container: handler.Container}
	var options json.RawMessage
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, staff, err := service.LoadLiveSessionInTransaction(ctx, tx, command.StaffId, command.SessionId)
		if err != nil {
			return err
		}
		encodedOptions, ceremony, err := service.BeginPasskeyAssertion(ctx, tx.Client(), staff)
		if err != nil {
			return err
		}
		options = encodedOptions
		return session.Update().SetWebauthnSession(ceremony).SetWebauthnCeremony(staffsession.WebauthnCeremonyStepUp).
			SetWebauthnExpiresAt(handler.Container.Now().Add(handler.Container.Settings.LoginChallengeTtl)).Exec(ctx)
	})
	return options, err
}
