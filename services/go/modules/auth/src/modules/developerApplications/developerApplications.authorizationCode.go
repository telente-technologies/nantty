package developerapplications

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

var errInvalidBusinessAuthorizationCode = errors.New("business consent authorization request is invalid")

type BusinessConsentAuthorizationRequest struct {
	RedirectURI         string `json:"redirectUri"`
	CodeChallenge       string `json:"codeChallenge"`
	CodeChallengeMethod string `json:"codeChallengeMethod"`
	State               string `json:"state"`
}

type BusinessConsentAuthorizationReceipt struct {
	ConsentID          string    `json:"consentId"`
	ApplicationID      string    `json:"applicationId"`
	StoreID            string    `json:"storeId"`
	RecipientAccountID string    `json:"recipientAccountId"`
	Scopes             []string  `json:"scopes"`
	GrantedAt          time.Time `json:"grantedAt"`
}

func validateBusinessConsentAuthorizationRequest(input *BusinessConsentAuthorizationRequest, registered []string) error {
	if input == nil {
		return nil
	}
	if err := validateBusinessConsentAuthorizationShape(*input); err != nil || !slices.Contains(registered, input.RedirectURI) {
		return errInvalidBusinessAuthorizationCode
	}
	return nil
}

func validateBusinessConsentAuthorizationShape(input BusinessConsentAuthorizationRequest) error {
	if input.CodeChallengeMethod != "S256" || !validConsentCodeChallenge(input.CodeChallenge) ||
		len(input.State) < 16 || len(input.State) > 512 || strings.TrimSpace(input.State) == "" ||
		len(input.RedirectURI) > 2048 {
		return errInvalidBusinessAuthorizationCode
	}
	parsed, err := url.Parse(input.RedirectURI)
	if err != nil || parsed.Fragment != "" || parsed.User != nil || parsed.Opaque != "" {
		return errInvalidBusinessAuthorizationCode
	}
	return nil
}

func parseBusinessConsentAuthorizationRequest(query url.Values) (*BusinessConsentAuthorizationRequest, error) {
	keys := []string{"redirect_uri", "code_challenge", "code_challenge_method", "state"}
	provided := false
	values := make([]string, len(keys))
	for index, key := range keys {
		items, exists := query[key]
		provided = provided || exists
		if exists && len(items) != 1 {
			return nil, errInvalidBusinessAuthorizationCode
		}
		if exists {
			values[index] = items[0]
		}
	}
	if !provided {
		return nil, nil
	}
	for _, value := range values {
		if value == "" {
			return nil, errInvalidBusinessAuthorizationCode
		}
	}
	return &BusinessConsentAuthorizationRequest{
		RedirectURI: values[0], CodeChallenge: values[1], CodeChallengeMethod: values[2], State: values[3],
	}, nil
}

func issueBusinessConsentAuthorizationCode(ctx context.Context, tx *sql.Tx, consent BusinessConsent, recipientID uuid.UUID, request *BusinessConsentAuthorizationRequest, now time.Time) (string, error) {
	if request == nil {
		return "", nil
	}
	rawCode := make([]byte, 32)
	if _, err := rand.Read(rawCode); err != nil {
		return "", err
	}
	code := base64.RawURLEncoding.EncodeToString(rawCode)
	codeHash := sha256.Sum256([]byte(code))
	if _, err := tx.ExecContext(ctx, `DELETE FROM developer_business_consent_authorization_codes
		WHERE code_hash IN (SELECT code_hash FROM developer_business_consent_authorization_codes
		WHERE expires_at < $1::timestamptz - interval '1 day' ORDER BY expires_at LIMIT 100)`, now); err != nil {
		return "", err
	}
	scopes, err := json.Marshal(consent.Scopes)
	if err != nil {
		return "", err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO developer_business_consent_authorization_codes
		(code_hash, consent_id, organization_id, application_id, store_id, recipient_account_id, consent_granted_at, redirect_uri, code_challenge, scopes, expires_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
		hex.EncodeToString(codeHash[:]), consent.ID, consent.OrganizationID, consent.ApplicationID, consent.StoreID,
		recipientID, consent.GrantedAt, request.RedirectURI, request.CodeChallenge, string(scopes), now.Add(60*time.Second), now)
	if err != nil {
		return "", err
	}
	callback, err := url.Parse(request.RedirectURI)
	if err != nil {
		return "", errInvalidBusinessAuthorizationCode
	}
	query := callback.Query()
	query.Set("code", code)
	query.Set("state", request.State)
	callback.RawQuery = query.Encode()
	return callback.String(), nil
}
func ConsumeBusinessConsentAuthorizationCode(ctx context.Context, db *sql.DB, code, redirectURI, verifier string, credentialID, applicationID uuid.UUID, now time.Time) (BusinessConsentAuthorizationReceipt, error) {
	if !validConsentAuthorizationCode(code) || !validConsentCodeVerifier(verifier) || len(redirectURI) > 2048 {
		return BusinessConsentAuthorizationReceipt{}, invalidConsentAuthorizationCode()
	}
	codeDigest := sha256.Sum256([]byte(code))
	tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return BusinessConsentAuthorizationReceipt{}, err
	}
	defer tx.Rollback()
	var receipt BusinessConsentAuthorizationReceipt
	var storedRedirect, storedChallenge string
	var rawScopes []byte
	err = tx.QueryRowContext(ctx, `SELECT code.consent_id, code.application_id, code.store_id, code.recipient_account_id,
		code.redirect_uri, code.code_challenge, code.scopes, consent.granted_at
		FROM developer_business_consent_authorization_codes code
		JOIN developer_business_consents consent ON consent.id=code.consent_id AND consent.status='active' AND consent.scopes=code.scopes
			AND consent.organization_id=code.organization_id AND consent.application_id=code.application_id
			AND consent.store_id=code.store_id AND consent.recipient_account_id=code.recipient_account_id
			AND consent.granted_at=code.consent_granted_at
		JOIN accounts recipient ON recipient.id=code.recipient_account_id AND recipient.status='active'
		JOIN developer_applications app ON app.id=code.application_id AND app.organization_id=code.organization_id
		JOIN developer_business_authorizations grant_row ON grant_row.organization_id=code.organization_id
			AND grant_row.application_id=code.application_id AND grant_row.store_id=code.store_id
		WHERE code.code_hash=$1 AND code.application_id=$2 AND code.consumed_at IS NULL AND code.expires_at>$3
			AND app.status='approved' AND app.requested_scopes @> code.scopes AND app.redirect_uris @> jsonb_build_array(code.redirect_uri)
			AND grant_row.status='active' AND grant_row.scopes @> code.scopes
		FOR UPDATE OF code`, hex.EncodeToString(codeDigest[:]), applicationID, now).
		Scan(&receipt.ConsentID, &receipt.ApplicationID, &receipt.StoreID, &receipt.RecipientAccountID,
			&storedRedirect, &storedChallenge, &rawScopes, &receipt.GrantedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return BusinessConsentAuthorizationReceipt{}, invalidConsentAuthorizationCode()
	}
	if err != nil {
		return BusinessConsentAuthorizationReceipt{}, err
	}
	if storedRedirect != redirectURI || !verifyConsentPKCE(verifier, storedChallenge) {
		return BusinessConsentAuthorizationReceipt{}, invalidConsentAuthorizationCode()
	}
	var credentialScopes []string
	err = tx.QueryRowContext(ctx, `SELECT credentials.scopes FROM developer_production_credentials credentials
		JOIN developer_applications app ON app.id=credentials.application_id
		WHERE credentials.id=$1 AND credentials.application_id=$2 AND credentials.status='active' AND app.status='approved'
		FOR SHARE OF credentials`, credentialID, applicationID).Scan(jsonScanner{target: &credentialScopes})
	if err == sql.ErrNoRows {
		return BusinessConsentAuthorizationReceipt{}, invalidConsentAuthorizationCode()
	}
	if err != nil {
		return BusinessConsentAuthorizationReceipt{}, err
	}
	if err := json.Unmarshal(rawScopes, &receipt.Scopes); err != nil {
		return BusinessConsentAuthorizationReceipt{}, err
	}
	for _, scope := range receipt.Scopes {
		if !slices.Contains(credentialScopes, scope) {
			return BusinessConsentAuthorizationReceipt{}, httpserver.NewApiError(403, "INSUFFICIENT_SCOPE", "The application credential does not include every customer-approved scope.")
		}
	}
	result, err := tx.ExecContext(ctx, `UPDATE developer_business_consent_authorization_codes SET consumed_at=$1, consumed_by_credential_id=$3 WHERE code_hash=$2 AND consumed_at IS NULL AND expires_at>$1`, now, hex.EncodeToString(codeDigest[:]), credentialID)
	if err != nil {
		return BusinessConsentAuthorizationReceipt{}, err
	}
	if changed, err := result.RowsAffected(); err != nil || changed != 1 {
		return BusinessConsentAuthorizationReceipt{}, invalidConsentAuthorizationCode()
	}
	if err := tx.Commit(); err != nil {
		return BusinessConsentAuthorizationReceipt{}, err
	}
	return receipt, nil
}

func validConsentCodeChallenge(challenge string) bool {
	decoded, err := base64.RawURLEncoding.Strict().DecodeString(challenge)
	return err == nil && len(decoded) == sha256.Size && len(challenge) == 43
}

func validConsentCodeVerifier(verifier string) bool {
	if len(verifier) < 43 || len(verifier) > 128 {
		return false
	}
	for _, character := range verifier {
		if !(character >= 'A' && character <= 'Z' || character >= 'a' && character <= 'z' || character >= '0' && character <= '9' || strings.ContainsRune("-._~", character)) {
			return false
		}
	}
	return true
}

func validConsentAuthorizationCode(code string) bool {
	decoded, err := base64.RawURLEncoding.Strict().DecodeString(code)
	return err == nil && len(decoded) == 32 && len(code) == 43
}

func verifyConsentPKCE(verifier, challenge string) bool {
	digest := sha256.Sum256([]byte(verifier))
	calculated := base64.RawURLEncoding.EncodeToString(digest[:])
	return subtle.ConstantTimeCompare([]byte(calculated), []byte(challenge)) == 1
}

func invalidConsentAuthorizationCode() error {
	return httpserver.NewApiError(401, "INVALID_AUTHORIZATION_CODE", "The business consent code is invalid, expired, already used, or no longer authorized.")
}
