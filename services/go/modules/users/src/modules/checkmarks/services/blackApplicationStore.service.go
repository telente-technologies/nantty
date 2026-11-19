package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
)

type BlackApplicationExtended struct {
	LegalIdentityName            string     `json:"legalIdentityName"`
	LegalRegistrationRef         string     `json:"legalRegistrationRef"`
	JurisdictionCountryCode      string     `json:"jurisdictionCountryCode"`
	OfficialWebsite              string     `json:"officialWebsite"`
	OfficialContactPhone         string     `json:"officialContactPhone"`
	InstitutionalEmail           string     `json:"institutionalEmail"`
	InstitutionalEmailVerified   bool       `json:"institutionalEmailVerified"`
	InstitutionalEmailVerifiedAt *time.Time `json:"institutionalEmailVerifiedAt,omitempty"`
	RepresentativeEmail          string     `json:"representativeEmail"`
	RepresentativeIdRef          string     `json:"representativeIdRef"`
	EvidenceNotes                string     `json:"evidenceNotes"`
	PrivateCheckoutEnabled       bool       `json:"privateCheckoutEnabled"`
	PrivateCheckoutAuthorizedBy  string     `json:"privateCheckoutAuthorizedBy,omitempty"`
	PrivateCheckoutAuthorizedAt  *time.Time `json:"privateCheckoutAuthorizedAt,omitempty"`
	PrivateCheckoutExpiresAt     *time.Time `json:"privateCheckoutExpiresAt,omitempty"`
	PrivateCheckoutRevokedAt     *time.Time `json:"privateCheckoutRevokedAt,omitempty"`
}

type BlackAppealView struct {
	Id                string     `json:"id"`
	ApplicationId     string     `json:"applicationId"`
	ProfileId         string     `json:"profileId"`
	AccountId         string     `json:"accountId"`
	Reason            string     `json:"reason"`
	SupportingDetails string     `json:"supportingDetails"`
	Status            string     `json:"status"`
	ReviewedByStaffId string     `json:"reviewedByStaffId,omitempty"`
	ReviewedByName    string     `json:"reviewedByName,omitempty"`
	DecisionNote      string     `json:"decisionNote,omitempty"`
	ReviewedAt        *time.Time `json:"reviewedAt,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
}

func SaveBlackApplicationDetails(ctx context.Context, db *sql.DB, applicationId uuid.UUID, details BlackApplicationExtended) error {
	if db == nil {
		return nil
	}
	_, err := db.ExecContext(ctx, `
		UPDATE black_applications
		SET legal_identity_name = $2,
		    legal_registration_ref = $3,
		    jurisdiction_country_code = $4,
		    official_website = $5,
		    official_contact_phone = $6,
		    institutional_email = $7,
		    representative_email = $8,
		    representative_id_ref = $9,
		    evidence_notes = $10
		WHERE id = $1`,
		applicationId, details.LegalIdentityName, details.LegalRegistrationRef, strings.ToUpper(details.JurisdictionCountryCode),
		details.OfficialWebsite, details.OfficialContactPhone, strings.ToLower(details.InstitutionalEmail),
		strings.ToLower(details.RepresentativeEmail), details.RepresentativeIdRef, details.EvidenceNotes,
	)
	return err
}

func LoadBlackApplicationDetails(ctx context.Context, db *sql.DB, applicationId uuid.UUID) (BlackApplicationExtended, error) {
	if db == nil {
		return BlackApplicationExtended{}, nil
	}
	var out BlackApplicationExtended
	err := db.QueryRowContext(ctx, `
		SELECT legal_identity_name, legal_registration_ref, jurisdiction_country_code, official_website,
		       official_contact_phone, institutional_email, institutional_email_verified, institutional_email_verified_at,
		       representative_email, representative_id_ref, evidence_notes, private_checkout_enabled,
		       private_checkout_authorized_by, private_checkout_authorized_at, private_checkout_expires_at, private_checkout_revoked_at
		FROM black_applications WHERE id = $1`, applicationId).Scan(
		&out.LegalIdentityName, &out.LegalRegistrationRef, &out.JurisdictionCountryCode, &out.OfficialWebsite,
		&out.OfficialContactPhone, &out.InstitutionalEmail, &out.InstitutionalEmailVerified, &out.InstitutionalEmailVerifiedAt,
		&out.RepresentativeEmail, &out.RepresentativeIdRef, &out.EvidenceNotes, &out.PrivateCheckoutEnabled,
		&out.PrivateCheckoutAuthorizedBy, &out.PrivateCheckoutAuthorizedAt, &out.PrivateCheckoutExpiresAt, &out.PrivateCheckoutRevokedAt,
	)
	if err == sql.ErrNoRows {
		return BlackApplicationExtended{}, nil
	}
	return out, err
}

func SetBlackPrivateCheckoutAuthorization(ctx context.Context, db *sql.DB, applicationId uuid.UUID, enabled bool, staffId string, now time.Time, expiresAt *time.Time) error {
	if db == nil {
		return nil
	}
	if enabled {
		_, err := db.ExecContext(ctx, `
			UPDATE black_applications
			SET private_checkout_enabled = true,
			    private_checkout_authorized_by = $2,
			    private_checkout_authorized_at = $3,
			    private_checkout_expires_at = $4,
			    private_checkout_revoked_at = NULL
			WHERE id = $1`, applicationId, staffId, now, expiresAt)
		return err
	}
	_, err := db.ExecContext(ctx, `
		UPDATE black_applications
		SET private_checkout_enabled = false,
		    private_checkout_revoked_at = $2
		WHERE id = $1`, applicationId, now)
	return err
}

func HashInstitutionalOtp(applicationId uuid.UUID, email, code string) string {
	sum := sha256.Sum256([]byte(applicationId.String() + ":" + strings.ToLower(strings.TrimSpace(email)) + ":" + strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

func GenerateSixDigitOtp() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func IssueInstitutionalEmailOtp(ctx context.Context, c *container.Container, applicationId, accountId uuid.UUID, email string) (string, time.Time, error) {
	code, err := GenerateSixDigitOtp()
	if err != nil {
		return "", time.Time{}, err
	}
	now := c.Now().UTC()
	expiresAt := now.Add(15 * time.Minute)
	if c.Database == nil {
		return code, expiresAt, nil
	}
	if _, err := c.Database.ExecContext(ctx, `UPDATE black_institutional_email_otps SET invalidated_at = $2 WHERE application_id = $1 AND verified_at IS NULL AND invalidated_at IS NULL`, applicationId, now); err != nil {
		return "", time.Time{}, err
	}
	_, err = c.Database.ExecContext(ctx, `
		INSERT INTO black_institutional_email_otps (id, application_id, account_id, email, otp_hash, attempts, max_attempts, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, 0, 5, $6, $7)`,
		uuid.Must(uuid.NewV7()), applicationId, accountId, strings.ToLower(strings.TrimSpace(email)), HashInstitutionalOtp(applicationId, email, code), expiresAt, now,
	)
	return code, expiresAt, err
}

func VerifyInstitutionalEmailOtp(ctx context.Context, c *container.Container, applicationId, accountId uuid.UUID, code string) (bool, string, error) {
	if c.Database == nil {
		return false, "DATABASE_UNAVAILABLE", nil
	}
	now := c.Now().UTC()
	var otpId uuid.UUID
	var email, expectedHash string
	var attempts, maxAttempts int
	var expiresAt time.Time
	err := c.Database.QueryRowContext(ctx, `
		SELECT id, email, otp_hash, attempts, max_attempts, expires_at
		FROM black_institutional_email_otps
		WHERE application_id = $1 AND account_id = $2 AND verified_at IS NULL AND invalidated_at IS NULL
		ORDER BY created_at DESC LIMIT 1`, applicationId, accountId).Scan(&otpId, &email, &expectedHash, &attempts, &maxAttempts, &expiresAt)
	if err == sql.ErrNoRows {
		return false, "OTP_NOT_FOUND", nil
	}
	if err != nil {
		return false, "", err
	}
	if !expiresAt.After(now) {
		_, _ = c.Database.ExecContext(ctx, `UPDATE black_institutional_email_otps SET invalidated_at = $2 WHERE id = $1`, otpId, now)
		return false, "OTP_EXPIRED", nil
	}
	if attempts >= maxAttempts {
		_, _ = c.Database.ExecContext(ctx, `UPDATE black_institutional_email_otps SET invalidated_at = $2 WHERE id = $1`, otpId, now)
		return false, "OTP_ATTEMPTS_EXCEEDED", nil
	}
	actualHash := HashInstitutionalOtp(applicationId, email, code)
	if subtle.ConstantTimeCompare([]byte(actualHash), []byte(expectedHash)) != 1 {
		_, _ = c.Database.ExecContext(ctx, `UPDATE black_institutional_email_otps SET attempts = attempts + 1 WHERE id = $1`, otpId)
		return false, "OTP_INVALID", nil
	}
	if _, err := c.Database.ExecContext(ctx, `UPDATE black_institutional_email_otps SET verified_at = $2 WHERE id = $1`, otpId, now); err != nil {
		return false, "", err
	}
	if _, err := c.Database.ExecContext(ctx, `
		UPDATE black_applications
		SET institutional_email_verified = true,
		    institutional_email_verified_at = $2,
		    status = CASE WHEN status = 'pending' THEN 'in_review' ELSE status END
		WHERE id = $1`, applicationId, now); err != nil {
		return false, "", err
	}
	return true, "", nil
}

func IsBlackApplicationApproved(ctx context.Context, db *sql.DB, profileId uuid.UUID) (bool, error) {
	if db == nil {
		return true, nil
	}
	var approved bool
	err := db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM black_applications WHERE profile_id = $1 AND status = 'approved')`, profileId).Scan(&approved)
	return approved, err
}
