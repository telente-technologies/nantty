package developerapplications

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
)

type BusinessConsentPreview struct {
	ApplicationID   string   `json:"applicationId"`
	Application     string   `json:"applicationName"`
	OrganizationID  string   `json:"organizationId"`
	Organization    string   `json:"organizationName"`
	StoreID         string   `json:"storeId"`
	StoreName       string   `json:"storeName"`
	RequestedScopes []string `json:"requestedScopes"`
	AvailableScopes []string `json:"availableScopes"`
}

func (service Service) GetBusinessConsentPreview(ctx context.Context, applicationID, storeID string, authorization *BusinessConsentAuthorizationRequest) (BusinessConsentPreview, error) {
	application, err := uuid.Parse(applicationID)
	if err != nil {
		return BusinessConsentPreview{}, errBusinessAuthorizationNotFound
	}
	store, err := uuid.Parse(storeID)
	if err != nil {
		return BusinessConsentPreview{}, errBusinessAuthorizationNotFound
	}
	var preview BusinessConsentPreview
	var redirectURIs []string
	err = service.Container.Database.QueryRowContext(ctx, `
		SELECT a.id, a.name, a.organization_id, o.name, store_grant.store_id,
		       store_grant.store_name, a.requested_scopes, store_grant.scopes, a.redirect_uris
		FROM developer_applications a
		JOIN developer_organizations o ON o.id = a.organization_id
		JOIN developer_business_authorizations store_grant
		  ON store_grant.organization_id = a.organization_id
		 AND store_grant.application_id = a.id
		WHERE a.id = $1 AND store_grant.store_id = $2
		  AND a.api_product = $3 AND a.status = 'approved'
		  AND store_grant.status = 'active'`, application, store, apiProductBusinessMessaging).
		Scan(&preview.ApplicationID, &preview.Application, &preview.OrganizationID, &preview.Organization,
			&preview.StoreID, &preview.StoreName, jsonScanner{target: &preview.RequestedScopes}, jsonScanner{target: &preview.AvailableScopes}, jsonScanner{target: &redirectURIs})
	if errors.Is(err, sql.ErrNoRows) {
		return BusinessConsentPreview{}, errBusinessAuthorizationNotFound
	}
	if err != nil {
		return BusinessConsentPreview{}, err
	}
	if err := validateBusinessConsentAuthorizationRequest(authorization, redirectURIs); err != nil {
		return BusinessConsentPreview{}, err
	}
	preview.AvailableScopes = intersectBusinessScopes(preview.RequestedScopes, preview.AvailableScopes)
	return preview, nil
}

func intersectBusinessScopes(requested, merchantGranted []string) []string {
	available := make([]string, 0, len(requested))
	for _, scope := range requested {
		if containsGrant(merchantGranted, scope) {
			available = append(available, scope)
		}
	}
	normalized, err := NormalizeBusinessConsentScopes(available)
	if err != nil {
		return []string{}
	}
	return normalized
}
