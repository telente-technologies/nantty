package developerapplications

import "time"

type Application struct {
	ID              string    `json:"id"`
	OrganizationID  string    `json:"organizationId"`
	Name            string    `json:"name"`
	Purpose         string    `json:"purpose"`
	APIProduct      string    `json:"apiProduct"`
	CallbackOrigins []string  `json:"callbackOrigins"`
	RedirectURIs    []string  `json:"redirectUris"`
	RequestedScopes []string  `json:"requestedScopes"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type ApplicationInput struct {
	Name            string   `json:"name"`
	Purpose         string   `json:"purpose"`
	CallbackOrigins []string `json:"callbackOrigins"`
	RedirectURIs    []string `json:"redirectUris"`
	RequestedScopes []string `json:"requestedScopes"`
}

type EffectiveApplicationCapabilities struct {
	ActorAccountID  string   `json:"actorAccountId"`
	OrganizationID  string   `json:"organizationId"`
	ApplicationID   string   `json:"applicationId"`
	ApplicationName string   `json:"applicationName"`
	Capabilities    []string `json:"capabilities"`
}
