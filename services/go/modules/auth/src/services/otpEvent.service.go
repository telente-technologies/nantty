package services

import (
	"context"
	"encoding/base64"
	"time"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/integrations"
	"nantty/platform/secretbox"
)

func WriteOneTimeCodeEvent(application *container.Container) integrations.OtpEventWriter {
	return func(ctx context.Context, destination, purpose, code string, expiresIn time.Duration) error {
		sealed, err := secretbox.SealWithAesGcm(application.Settings.OtpEventKey, []byte(code))
		if err != nil {
			return err
		}
		keyId := application.Settings.OtpEventKeyId
		if keyId == "" {
			keyId = "otp-1"
		}
		now := application.Now()
		return application.RunInTransaction(ctx, func(tx *ent.Tx) error {
			return events.EnqueueOutboxEventInTransaction(ctx, tx, "otp.issued", destination, now, events.OtpIssuedEventData{
				Destination: destination, Purpose: purpose, CodeSealed: base64.StdEncoding.EncodeToString(sealed), KeyId: keyId,
				ExpiresAt: now.Add(expiresIn).UTC().Format(time.RFC3339), ExpiresInMinutes: int(expiresIn.Minutes()),
			})
		})
	}
}
