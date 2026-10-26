package services

import (
	"context"
	"encoding/base64"
	"encoding/json"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffwebauthncredential"
)

type staffPasskeyUser struct {
	account     *ent.StaffAccount
	credentials []webauthn.Credential
}

func (user staffPasskeyUser) WebAuthnID() []byte {
	identifier := user.account.ID
	return identifier[:]
}

func (user staffPasskeyUser) WebAuthnName() string { return user.account.Email }

func (user staffPasskeyUser) WebAuthnDisplayName() string {
	if user.account.DisplayName != "" {
		return user.account.DisplayName
	}
	return user.account.Email
}

func (user staffPasskeyUser) WebAuthnCredentials() []webauthn.Credential { return user.credentials }

func EncodeCredentialId(raw []byte) string {
	return base64.RawURLEncoding.EncodeToString(raw)
}

func (service StaffAuthService) loadPasskeyUser(ctx context.Context, client *ent.Client, account *ent.StaffAccount) (staffPasskeyUser, error) {
	rows, err := client.StaffWebauthnCredential.Query().Where(staffwebauthncredential.StaffID(account.ID)).All(ctx)
	if err != nil {
		return staffPasskeyUser{}, err
	}
	user := staffPasskeyUser{account: account, credentials: make([]webauthn.Credential, 0, len(rows))}
	for _, row := range rows {
		var credential webauthn.Credential
		if err := json.Unmarshal(row.Credential, &credential); err != nil {
			return staffPasskeyUser{}, err
		}
		user.credentials = append(user.credentials, credential)
	}
	return user, nil
}

func (service StaffAuthService) relyingParty() (*webauthn.WebAuthn, error) {
	if service.Container.WebAuthn == nil {
		return nil, adminerrors.PasskeysUnavailable
	}
	return service.Container.WebAuthn, nil
}

func (service StaffAuthService) BeginPasskeyAssertion(ctx context.Context, client *ent.Client, account *ent.StaffAccount) (json.RawMessage, []byte, error) {
	relyingParty, err := service.relyingParty()
	if err != nil {
		return nil, nil, err
	}
	user, err := service.loadPasskeyUser(ctx, client, account)
	if err != nil {
		return nil, nil, err
	}
	if len(user.credentials) == 0 {
		return nil, nil, adminerrors.NoPasskeys
	}
	assertion, session, err := relyingParty.BeginLogin(user, webauthn.WithUserVerification(protocol.VerificationRequired))
	if err != nil {
		return nil, nil, err
	}
	return encodeCeremony(assertion.Response, session)
}

func (service StaffAuthService) BeginPasskeyRegistration(ctx context.Context, client *ent.Client, account *ent.StaffAccount) (json.RawMessage, []byte, error) {
	relyingParty, err := service.relyingParty()
	if err != nil {
		return nil, nil, err
	}
	user, err := service.loadPasskeyUser(ctx, client, account)
	if err != nil {
		return nil, nil, err
	}
	creation, session, err := relyingParty.BeginRegistration(user,
		webauthn.WithExclusions(webauthn.Credentials(user.credentials).CredentialDescriptors()),
		webauthn.WithAuthenticatorSelection(protocol.AuthenticatorSelection{ResidentKey: protocol.ResidentKeyRequirementPreferred, UserVerification: protocol.VerificationRequired}),
		webauthn.WithConveyancePreference(protocol.PreferNoAttestation),
	)
	if err != nil {
		return nil, nil, err
	}
	return encodeCeremony(creation.Response, session)
}

func encodeCeremony(options any, session *webauthn.SessionData) (json.RawMessage, []byte, error) {
	encodedOptions, err := json.Marshal(options)
	if err != nil {
		return nil, nil, err
	}
	encodedSession, err := json.Marshal(session)
	return encodedOptions, encodedSession, err
}

func decodeCeremonySession(encoded []byte) (webauthn.SessionData, bool) {
	var session webauthn.SessionData
	if len(encoded) == 0 || json.Unmarshal(encoded, &session) != nil || session.Challenge == "" {
		return webauthn.SessionData{}, false
	}
	return session, true
}

func (service StaffAuthService) FinishPasskeyRegistration(ctx context.Context, client *ent.Client, account *ent.StaffAccount, encodedSession []byte, response json.RawMessage) (*webauthn.Credential, error) {
	relyingParty, err := service.relyingParty()
	if err != nil {
		return nil, err
	}
	session, found := decodeCeremonySession(encodedSession)
	if !found {
		return nil, adminerrors.PasskeyExpired
	}
	user, err := service.loadPasskeyUser(ctx, client, account)
	if err != nil {
		return nil, err
	}
	parsed, err := protocol.ParseCredentialCreationResponseBytes(response)
	if err != nil {
		return nil, adminerrors.PasskeyNotVerified
	}
	credential, err := relyingParty.CreateCredential(user, session, parsed)
	if err != nil {
		service.Container.Logger.InfoContext(ctx, "passkey registration rejected", "staffId", account.ID.String(), "error", err)
		return nil, adminerrors.PasskeyNotVerified
	}
	return credential, nil
}

func (service StaffAuthService) VerifyPasskeyAssertionInTransaction(ctx context.Context, tx *ent.Tx, account *ent.StaffAccount, encodedSession []byte, response json.RawMessage) (bool, error) {
	relyingParty, err := service.relyingParty()
	if err != nil {
		return false, err
	}
	session, found := decodeCeremonySession(encodedSession)
	if !found {
		return false, nil
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(response)
	if err != nil {
		return false, nil
	}
	stored, err := tx.StaffWebauthnCredential.Query().
		Where(staffwebauthncredential.CredentialID(EncodeCredentialId(parsed.RawID)), staffwebauthncredential.StaffID(account.ID)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	user, err := service.loadPasskeyUser(ctx, tx.Client(), account)
	if err != nil {
		return false, err
	}
	credential, err := relyingParty.ValidateLogin(user, session, parsed)
	if err != nil {
		service.Container.Logger.InfoContext(ctx, "passkey assertion rejected", "staffId", account.ID.String(), "error", err)
		return false, nil
	}
	if credential.Authenticator.CloneWarning {
		service.Container.Logger.WarnContext(ctx, "passkey sign count went backwards; possible cloned authenticator", "staffId", account.ID.String(), "passkeyId", stored.ID.String())
		return false, nil
	}
	encoded, err := json.Marshal(credential)
	if err != nil {
		return false, err
	}
	return true, stored.Update().SetCredential(encoded).SetSignCount(int64(credential.Authenticator.SignCount)).SetLastUsedAt(service.Container.Now()).Exec(ctx)
}
