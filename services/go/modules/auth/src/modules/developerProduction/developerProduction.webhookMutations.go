package developerproduction

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

func (store Store) CreateWebhook(ctx context.Context, orgUUID, appUUID uuid.UUID, accountID, webhookUrl string, events []string) (WebhookView, string, error) {
	actorID, err := uuid.Parse(accountID)
	if err != nil {
		return WebhookView{}, "", httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SESSION", "Sign in again to manage this webhook.")
	}
	if err := ValidateWebhookDNS(ctx, webhookUrl); err != nil {
		return WebhookView{}, "", err
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return WebhookView{}, "", err
	}
	secret := "whsec_" + hex.EncodeToString(raw)
	ciphertext, err := SealWebhookSecret(secret)
	if err != nil {
		return WebhookView{}, "", err
	}
	preview := "whsec_••••" + secret[len(secret)-4:]
	eventsJSON, err := json.Marshal(events)
	if err != nil {
		return WebhookView{}, "", err
	}
	now := store.Container.Now().UTC()
	id := uuid.New()
	tx, err := store.Container.Database.BeginTx(ctx, nil)
	if err != nil {
		return WebhookView{}, "", err
	}
	defer tx.Rollback()
	role, err := store.lockProductionManager(ctx, tx, orgUUID, appUUID, actorID, "webhooks.manage", true)
	if err != nil {
		return WebhookView{}, "", err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO developer_production_webhooks
		(id, application_id, organization_id, url, events, signing_secret_preview, signing_secret_hash, signing_secret_ciphertext, active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, true, $9, $9)`,
		id, appUUID, orgUUID, webhookUrl, string(eventsJSON), preview, Sha256Hex(secret), ciphertext, now); err != nil {
		return WebhookView{}, "", err
	}
	after, err := json.Marshal(map[string]any{"webhookId": id.String(), "active": true, "events": events})
	if err != nil {
		return WebhookView{}, "", err
	}
	if err := writeProductionResourceAudit(ctx, tx, orgUUID, actorID, id.String(), role, "production_webhook", "webhook.created", `{}`, string(after), now); err != nil {
		return WebhookView{}, "", err
	}
	if err := tx.Commit(); err != nil {
		return WebhookView{}, "", err
	}
	return WebhookView{Id: id.String(), Url: webhookUrl, Events: events, Active: true, SigningSecretPreview: preview, CreatedAt: now}, secret, nil
}

func (store Store) DeleteWebhook(ctx context.Context, orgUUID, appUUID, webhookID uuid.UUID, accountID string) error {
	actorID, err := uuid.Parse(accountID)
	if err != nil {
		return httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SESSION", "Sign in again to manage this webhook.")
	}
	tx, err := store.Container.Database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	role, err := store.lockProductionManager(ctx, tx, orgUUID, appUUID, actorID, "webhooks.manage", false)
	if err != nil {
		return err
	}
	var active bool
	if err := tx.QueryRowContext(ctx, `SELECT active FROM developer_production_webhooks WHERE id = $1 AND organization_id = $2 AND application_id = $3 FOR UPDATE`, webhookID, orgUUID, appUUID).Scan(&active); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found.")
		}
		return err
	}
	result, err := tx.ExecContext(ctx, `DELETE FROM developer_production_webhooks WHERE id = $1 AND organization_id = $2 AND application_id = $3`, webhookID, orgUUID, appUUID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil || affected != 1 {
		if err != nil {
			return err
		}
		return httpserver.NewApiError(http.StatusConflict, "WEBHOOK_DELETE_CONFLICT", "The webhook changed. Reload and try again.")
	}
	before, err := json.Marshal(map[string]any{"webhookId": webhookID.String(), "active": active})
	if err != nil {
		return err
	}
	after, err := json.Marshal(map[string]string{"webhookId": webhookID.String(), "status": "deleted"})
	if err != nil {
		return err
	}
	if err := writeProductionResourceAudit(ctx, tx, orgUUID, actorID, webhookID.String(), role, "production_webhook", "webhook.deleted", string(before), string(after), store.Container.Now().UTC()); err != nil {
		return err
	}
	return tx.Commit()
}

func (store Store) RotateWebhookSecret(ctx context.Context, orgUUID, appUUID, webhookID uuid.UUID, accountID string) (string, string, error) {
	actorID, err := uuid.Parse(accountID)
	if err != nil {
		return "", "", httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SESSION", "Sign in again to manage this webhook.")
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	secret := "whsec_" + hex.EncodeToString(raw)
	ciphertext, err := SealWebhookSecret(secret)
	if err != nil {
		return "", "", err
	}
	preview := "whsec_••••" + secret[len(secret)-4:]
	now := store.Container.Now().UTC()
	tx, err := store.Container.Database.BeginTx(ctx, nil)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback()
	role, err := store.lockProductionManager(ctx, tx, orgUUID, appUUID, actorID, "webhooks.manage", true)
	if err != nil {
		return "", "", err
	}
	var oldPreview string
	if err := tx.QueryRowContext(ctx, `SELECT signing_secret_preview FROM developer_production_webhooks WHERE id = $1 AND organization_id = $2 AND application_id = $3 FOR UPDATE`, webhookID, orgUUID, appUUID).Scan(&oldPreview); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found.")
		}
		return "", "", err
	}
	result, err := tx.ExecContext(ctx, `UPDATE developer_production_webhooks SET signing_secret_preview = $1, signing_secret_hash = $2, signing_secret_ciphertext = $3, updated_at = $4 WHERE id = $5 AND organization_id = $6 AND application_id = $7`, preview, Sha256Hex(secret), ciphertext, now, webhookID, orgUUID, appUUID)
	if err != nil {
		return "", "", err
	}
	if affected, err := result.RowsAffected(); err != nil || affected != 1 {
		if err != nil {
			return "", "", err
		}
		return "", "", httpserver.NewApiError(http.StatusConflict, "WEBHOOK_ROTATION_CONFLICT", "The webhook changed. Reload and try again.")
	}
	before, err := json.Marshal(map[string]string{"webhookId": webhookID.String(), "signingSecretPreview": oldPreview})
	if err != nil {
		return "", "", err
	}
	after, err := json.Marshal(map[string]string{"webhookId": webhookID.String(), "signingSecretPreview": preview})
	if err != nil {
		return "", "", err
	}
	if err := writeProductionResourceAudit(ctx, tx, orgUUID, actorID, webhookID.String(), role, "production_webhook", "webhook.secret_rotated", string(before), string(after), now); err != nil {
		return "", "", err
	}
	if err := tx.Commit(); err != nil {
		return "", "", err
	}
	return secret, preview, nil
}

func (store Store) PrepareWebhookVerification(ctx context.Context, orgUUID, appUUID, webhookID uuid.UUID, accountID string) (string, string, error) {
	actorID, err := uuid.Parse(accountID)
	if err != nil {
		return "", "", httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SESSION", "Sign in again to manage this webhook.")
	}
	tx, err := store.Container.Database.BeginTx(ctx, nil)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback()
	if _, err := store.lockProductionManager(ctx, tx, orgUUID, appUUID, actorID, "webhooks.manage", true); err != nil {
		return "", "", err
	}
	var targetURL, ciphertext string
	var active bool
	err = tx.QueryRowContext(ctx, `
		SELECT url, COALESCE(signing_secret_ciphertext, ''), active FROM developer_production_webhooks
		WHERE id = $1 AND organization_id = $2 AND application_id = $3 FOR UPDATE`, webhookID, orgUUID, appUUID).Scan(&targetURL, &ciphertext, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found.")
	}
	if err != nil {
		return "", "", err
	}
	if !active {
		return "", "", httpserver.NewApiError(http.StatusConflict, "WEBHOOK_INACTIVE", "An inactive webhook cannot be verified.")
	}
	if err := tx.Commit(); err != nil {
		return "", "", err
	}
	return targetURL, ciphertext, nil
}

func (store Store) RecordWebhookVerification(ctx context.Context, orgUUID, appUUID, webhookID uuid.UUID, accountID, outcome string) error {
	actorID, err := uuid.Parse(accountID)
	if err != nil {
		return httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SESSION", "Sign in again to manage this webhook.")
	}
	if outcome != "verified" && outcome != "delivery_failed" && outcome != "dns_validation_failed" && outcome != "secret_unavailable" && outcome != "challenge_mismatch" {
		return errors.New("invalid webhook verification outcome")
	}
	tx, err := store.Container.Database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	role, err := store.lockProductionManager(ctx, tx, orgUUID, appUUID, actorID, "webhooks.manage", true)
	if err != nil {
		return err
	}
	var previouslyVerified bool
	err = tx.QueryRowContext(ctx, `
		SELECT verified_at IS NOT NULL FROM developer_production_webhooks
		WHERE id = $1 AND organization_id = $2 AND application_id = $3 AND active = true FOR UPDATE`, webhookID, orgUUID, appUUID).Scan(&previouslyVerified)
	if errors.Is(err, sql.ErrNoRows) {
		return httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Active webhook not found.")
	}
	if err != nil {
		return err
	}
	now := store.Container.Now().UTC()
	var result sql.Result
	if outcome == "verified" {
		result, err = tx.ExecContext(ctx, `UPDATE developer_production_webhooks SET verified_at = $1, last_error = NULL, updated_at = $1 WHERE id = $2 AND organization_id = $3 AND application_id = $4 AND active = true`, now, webhookID, orgUUID, appUUID)
	} else {
		result, err = tx.ExecContext(ctx, `UPDATE developer_production_webhooks SET last_error = $1, updated_at = $2 WHERE id = $3 AND organization_id = $4 AND application_id = $5 AND active = true`, outcome, now, webhookID, orgUUID, appUUID)
	}
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil || affected != 1 {
		if err != nil {
			return err
		}
		return httpserver.NewApiError(http.StatusConflict, "WEBHOOK_VERIFICATION_CONFLICT", "The webhook changed during verification.")
	}
	before, err := json.Marshal(map[string]any{"verified": previouslyVerified})
	if err != nil {
		return err
	}
	after, err := json.Marshal(map[string]any{"verified": outcome == "verified", "outcome": outcome})
	if err != nil {
		return err
	}
	if err := writeProductionResourceAudit(ctx, tx, orgUUID, actorID, webhookID.String(), role, "production_webhook", "webhook.verification_"+outcome, string(before), string(after), now); err != nil {
		return err
	}
	return tx.Commit()
}
