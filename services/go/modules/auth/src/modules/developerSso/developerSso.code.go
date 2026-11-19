package developersso

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"nantty/platform/httpserver"
)

func ConsumeCode(ctx context.Context, db *sql.DB, codeHash, clientId, redirectUri, verifier string, now time.Time) (string, string, error) {
	var storedClient, storedRedirect, challenge string
	err := db.QueryRowContext(ctx,
		`SELECT client_id, redirect_uri, code_challenge FROM developer_sso_codes
		 WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > $2`,
		codeHash, now,
	).Scan(&storedClient, &storedRedirect, &challenge)
	if err == sql.ErrNoRows {
		return "", "", httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SSO_CODE", "Authorization code is invalid, expired, or already used.")
	}
	if err != nil {
		return "", "", err
	}
	if storedClient != clientId || storedRedirect != redirectUri || !VerifyPKCES256(verifier, challenge) {
		return "", "", httpserver.NewApiError(http.StatusUnauthorized, "PKCE_VERIFICATION_FAILED", "PKCE verification or redirect URI mismatch.")
	}
	var accountId, sessionId string
	err = db.QueryRowContext(ctx,
		`UPDATE developer_sso_codes c SET consumed_at = $2
		 WHERE c.code_hash = $1 AND c.consumed_at IS NULL AND c.expires_at > $2
		   AND c.client_id = $3 AND c.redirect_uri = $4 AND c.code_challenge = $5
		   AND EXISTS (
		     SELECT 1 FROM sessions s JOIN accounts a ON a.id = s.account_id
		     WHERE s.id = c.session_id AND s.account_id = c.account_id
		       AND s.revoked_at IS NULL AND s.expires_at > $2 AND a.status = 'active'
		   )
		 RETURNING c.account_id::text, c.session_id::text`,
		codeHash, now, clientId, redirectUri, challenge,
	).Scan(&accountId, &sessionId)
	if err == sql.ErrNoRows {
		return "", "", httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SSO_CODE", "Authorization code is invalid, expired, or its session is no longer active.")
	}
	return accountId, sessionId, err
}
