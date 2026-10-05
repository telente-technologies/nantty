package beginpasskeyregistration

import (
	"context"
	"encoding/json"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffsession"
	staffauthservices "zudomart/modules/admin/src/modules/staffAuth/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (json.RawMessage, error) {
	service := staffauthservices.StaffAuthService{Container: handler.Container}
	var options json.RawMessage
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, staff, err := service.LoadLiveSessionInTransaction(ctx, tx, command.Actor.Id, command.Actor.SessionId)
		if err != nil {
			return err
		}
		encodedOptions, ceremony, err := service.BeginPasskeyRegistration(ctx, tx.Client(), staff)
		if err != nil {
			return err
		}
		options = encodedOptions
		return session.Update().SetWebauthnSession(ceremony).SetWebauthnCeremony(staffsession.WebauthnCeremonyRegister).
			SetWebauthnExpiresAt(handler.Container.Now().Add(handler.Container.Settings.LoginChallengeTtl)).Exec(ctx)
	})
	return options, err
}
