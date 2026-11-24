package services

import (
	"context"
	"encoding/base64"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/platform/secretbox"
)

func EnqueueInstitutionalEmailOtpEvents(ctx context.Context, c *container.Container, applicationId, accountId uuid.UUID, email, code string, expiresAt time.Time) error {
	now := c.Now()
	return c.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, "blackApplication.institutionalEmailOtpRequested", applicationId.String(), now, map[string]any{
			"applicationId": applicationId.String(),
			"accountId":     accountId.String(),
			"email":         email,
			"expiresAt":     expiresAt.UTC().Format(time.RFC3339),
		}); err != nil {
			return err
		}
		if len(c.Settings.OtpEventKey) != 32 || code == "" {
			return nil
		}
		sealed, err := secretbox.SealWithAesGcm(c.Settings.OtpEventKey, []byte(code))
		if err != nil {
			return err
		}
		keyId := c.Settings.OtpEventKeyId
		if keyId == "" {
			keyId = "otp-1"
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, "otp.issued", email, now, map[string]any{
			"accountId":        accountId.String(),
			"destination":      email,
			"purpose":          "verify your institutional government email",
			"codeSealed":       base64.StdEncoding.EncodeToString(sealed),
			"keyId":            keyId,
			"expiresAt":        expiresAt.UTC().Format(time.RFC3339),
			"expiresInMinutes": 15,
		})
	})
}
