package services

import (
	"context"
	"time"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/events"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/integrations"
)

func WriteOneTimeCodeEvent(application *container.Container) integrations.OtpEventWriter {
	return func(ctx context.Context, destination, purpose, code string, expiresIn time.Duration) error {
		return application.RunInTransaction(ctx, func(tx *ent.Tx) error {
			return events.EnqueueOutboxEventInTransaction(ctx, tx, "otp.issued", destination, application.Now(), events.OtpIssuedEventData{
				Destination: destination, Purpose: purpose, Code: code, ExpiresInMinutes: int(expiresIn.Minutes()),
			})
		})
	}
}
