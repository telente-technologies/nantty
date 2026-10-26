package addpasskey

import (
	"context"
	"encoding/json"
	"strings"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffsession"
	"nantty/modules/admin/src/generated/ent/staffwebauthncredential"
	"nantty/modules/admin/src/modules/staffAccount/models"
	"nantty/modules/admin/src/modules/staffAccount/services"
	staffauthservices "nantty/modules/admin/src/modules/staffAuth/services"
)

const maximumPasskeysPerStaff = 10

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.PasskeyView, error) {
	service := staffauthservices.StaffAuthService{Container: handler.Container}
	var created *ent.StaffWebauthnCredential
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, staff, err := service.LoadLiveSessionInTransaction(ctx, tx, command.Actor.Id, command.Actor.SessionId)
		if err != nil {
			return err
		}
		now := handler.Container.Now()
		if session.WebauthnCeremony == nil || *session.WebauthnCeremony != staffsession.WebauthnCeremonyRegister || session.WebauthnExpiresAt == nil || !session.WebauthnExpiresAt.After(now) {
			return adminerrors.PasskeyExpired
		}
		if count, err := tx.StaffWebauthnCredential.Query().Where(staffwebauthncredential.StaffID(staff.ID)).Count(ctx); err != nil || count >= maximumPasskeysPerStaff {
			return adminerrors.FirstError(err, adminerrors.Conflict("TOO_MANY_PASSKEYS", "Remove a passkey before adding another."))
		}
		credential, err := service.FinishPasskeyRegistration(ctx, tx.Client(), staff, session.WebauthnSession, command.Credential)
		if err != nil {
			return err
		}
		credentialId := staffauthservices.EncodeCredentialId(credential.ID)
		if exists, err := tx.StaffWebauthnCredential.Query().Where(staffwebauthncredential.CredentialID(credentialId)).Exist(ctx); err != nil || exists {
			return adminerrors.FirstError(err, adminerrors.PasskeyExists)
		}
		encoded, err := json.Marshal(credential)
		if err != nil {
			return err
		}
		transports := make([]string, 0, len(credential.Transport))
		for _, transport := range credential.Transport {
			transports = append(transports, string(transport))
		}
		created, err = tx.StaffWebauthnCredential.Create().SetStaffID(staff.ID).SetCredentialID(credentialId).SetCredential(encoded).
			SetSignCount(int64(credential.Authenticator.SignCount)).SetTransports(transports).SetLabel(strings.TrimSpace(command.Label)).Save(ctx)
		if err != nil {
			return err
		}
		if err := session.Update().ClearWebauthnSession().ClearWebauthnCeremony().ClearWebauthnExpiresAt().Exec(ctx); err != nil {
			return err
		}
		return services.RecordOwnAccountChange(ctx, tx, command.Actor, staff, "admin.passkey_added", nil, map[string]any{"passkeyId": created.ID.String(), "label": created.Label})
	})
	if err != nil {
		return models.PasskeyView{}, err
	}
	return models.ConvertPasskeyToView(created), nil
}
