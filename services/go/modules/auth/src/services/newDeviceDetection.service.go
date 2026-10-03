package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/events"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/session"
	"zudomart/modules/auth/src/types"
)

type NewDeviceEventData struct {
	AccountId string `json:"accountId"`
	Device    string `json:"device,omitempty"`
	IpAddress string `json:"ipAddress,omitempty"`
}

func AnnounceNewDeviceInTransaction(ctx context.Context, application *container.Container, tx *ent.Tx, accountId uuid.UUID, client types.ClientDetails) error {
	if client.DeviceId == "" {
		return nil
	}
	hash := HashBlockedIdentifier(application.Settings.OneTimeCodePepper, "device", client.DeviceId)
	if known, err := tx.Session.Query().Where(session.AccountID(accountId), session.DeviceHash(hash)).Exist(ctx); err != nil || known {
		return err
	}
	if anySession, err := tx.Session.Query().Where(session.AccountID(accountId)).Exist(ctx); err != nil || !anySession {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "signIn.newDeviceDetected", accountId.String(), application.Now(), NewDeviceEventData{AccountId: accountId.String(), Device: client.UserAgent, IpAddress: client.IpAddress})
}
