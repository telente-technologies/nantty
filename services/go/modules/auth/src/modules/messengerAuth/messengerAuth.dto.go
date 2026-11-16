package messengerauth

import "nantty/modules/auth/src/types"

type CreateRequest struct {
	Identifier         string `json:"identifier"`
	Password           string `json:"password"`
	Platform           string `json:"platform"`
	DeviceName         string `json:"deviceName"`
	InstallationID     string `json:"installationId"`
	TrustedDeviceToken string `json:"trustedDeviceToken"`
}

type VerifyCodeRequest struct {
	Code string `json:"code"`
}

type RecoveryEmailResponse struct {
	Status          string `json:"status"`
	DestinationHint string `json:"destinationHint"`
	ExpiresIn       int    `json:"expiresIn"`
}

type PendingResponse struct {
	AuthorizationID string        `json:"authorizationId"`
	Proof           string        `json:"proof"`
	Status          string        `json:"status"`
	ExpiresAt       string        `json:"expiresAt"`
	Methods         []string      `json:"methods"`
	Device          DeviceContext `json:"device"`
}

type StatusResponse struct {
	Status    string        `json:"status"`
	ExpiresAt string        `json:"expiresAt"`
	Device    DeviceContext `json:"device"`
}

type PendingAuthorizationsResponse struct {
	Authorizations []PendingAuthorizationView `json:"authorizations"`
}

type PendingAuthorizationView struct {
	ID        string        `json:"id"`
	Status    string        `json:"status"`
	Device    DeviceContext `json:"device"`
	ExpiresAt string        `json:"expiresAt"`
}

type DeviceContext struct {
	Name                string  `json:"name"`
	Platform            string  `json:"platform"`
	RequestedAt         string  `json:"requestedAt"`
	ApproximateLocation *string `json:"approximateLocation"`
}

type CodeResponse struct {
	AuthorizationID string `json:"authorizationId"`
	Code            string `json:"code"`
	ExpiresAt       string `json:"expiresAt"`
}

type CompleteResponse struct {
	types.AuthSessionResponse
	TrustedDevice TrustedDeviceResponse `json:"trustedDevice"`
}

type TrustedDeviceResponse struct {
	ID        string `json:"id"`
	Token     string `json:"token"`
	ExpiresAt string `json:"expiresAt"`
}

type TrustedDeviceView struct {
	ID         string `json:"id"`
	Platform   string `json:"platform"`
	DeviceName string `json:"deviceName"`
	CreatedAt  string `json:"createdAt"`
	LastUsedAt string `json:"lastUsedAt"`
	ExpiresAt  string `json:"expiresAt"`
}
