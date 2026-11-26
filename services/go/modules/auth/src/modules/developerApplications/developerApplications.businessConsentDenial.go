package developerapplications

import (
	"context"
	"database/sql"
	"errors"
	"net/url"

	"github.com/google/uuid"
)

type BusinessConsentDenialInput struct {
	Authorization BusinessConsentAuthorizationRequest `json:"authorization"`
}

type BusinessConsentDenialResponse struct {
	AuthorizationRedirectURL string `json:"authorizationRedirectUrl"`
}

func (service Service) BuildBusinessConsentDenialRedirect(ctx context.Context, applicationID, storeID string, authorization BusinessConsentAuthorizationRequest) (string, error) {
	application, err := uuid.Parse(applicationID)
	if err != nil {
		return "", errBusinessAuthorizationNotFound
	}
	store, err := uuid.Parse(storeID)
	if err != nil {
		return "", errBusinessAuthorizationNotFound
	}
	var redirectURIs []string
	err = service.Container.Database.QueryRowContext(ctx, `
		SELECT app.redirect_uris
		FROM developer_applications app
		JOIN developer_business_authorizations store_grant
		  ON store_grant.organization_id=app.organization_id AND store_grant.application_id=app.id
		WHERE app.id=$1 AND store_grant.store_id=$2 AND app.api_product=$3
		  AND app.status='approved' AND store_grant.status='active'`,
		application, store, apiProductBusinessMessaging).Scan(jsonScanner{target: &redirectURIs})
	if errors.Is(err, sql.ErrNoRows) {
		return "", errBusinessAuthorizationNotFound
	}
	if err != nil {
		return "", err
	}
	if err := validateBusinessConsentAuthorizationRequest(&authorization, redirectURIs); err != nil {
		return "", err
	}
	callback, err := url.Parse(authorization.RedirectURI)
	if err != nil {
		return "", errInvalidBusinessAuthorizationCode
	}
	query := callback.Query()
	query.Set("error", "access_denied")
	query.Set("state", authorization.State)
	callback.RawQuery = query.Encode()
	return callback.String(), nil
}
