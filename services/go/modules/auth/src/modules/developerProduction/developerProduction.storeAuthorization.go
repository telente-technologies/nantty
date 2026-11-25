package developerproduction

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

func requireBusinessStoreCapability(ctx context.Context, db *sql.DB, organizationID, applicationID, storeID uuid.UUID, capability string) error {
	var rawScopes []byte
	err := db.QueryRowContext(ctx,
		`SELECT scopes FROM developer_business_authorizations
		 WHERE organization_id = $1 AND application_id = $2 AND store_id = $3 AND status = 'active'`,
		organizationID, applicationID, storeID,
	).Scan(&rawScopes)
	if err == sql.ErrNoRows {
		return httpserver.NewApiError(http.StatusForbidden, "BUSINESS_STORE_AUTHORIZATION_REQUIRED", "This application is not authorized for the requested store.")
	}
	if err != nil {
		return err
	}
	var scopes []string
	if err := json.Unmarshal(rawScopes, &scopes); err != nil {
		return httpserver.NewApiError(http.StatusInternalServerError, "BUSINESS_STORE_AUTHORIZATION_INVALID", "The store authorization record is invalid.")
	}
	for _, scope := range scopes {
		if strings.TrimSpace(scope) == capability {
			return nil
		}
	}
	return httpserver.NewApiError(http.StatusForbidden, "INSUFFICIENT_BUSINESS_STORE_PERMISSION", "The application does not have the required permission for this store.").WithDetails(map[string]any{"requiredScope": capability})
}

func parseBusinessStoreID(raw string) (uuid.UUID, error) {
	storeID, err := uuid.Parse(strings.TrimSpace(raw))
	if err != nil || storeID == uuid.Nil {
		return uuid.Nil, httpserver.NewApiError(http.StatusBadRequest, "INVALID_STORE_ID", "A valid storeId is required.")
	}
	return storeID, nil
}
