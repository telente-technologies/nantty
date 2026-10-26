package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/userconsent"
	"nantty/modules/users/src/modules/consents/models"
)

type DeviceDecision struct {
	Decision  models.Decision
	DecidedAt time.Time
	Policy    string
}

func ChooseDeviceDecisionsThatWinOverAccount(deviceRows, accountRows map[string]*ent.UserConsent) []DeviceDecision {
	var winners []DeviceDecision
	for _, consentType := range models.OptionalConsentTypes {
		device := deviceRows[consentType]
		if device == nil {
			continue
		}
		account := accountRows[consentType]
		if account != nil && (!device.ConsentedAt.After(account.ConsentedAt) || account.Status == device.Status) {
			continue
		}
		winners = append(winners, DeviceDecision{
			Decision:  models.Decision{ConsentType: consentType, Granted: device.Status == userconsent.StatusGranted},
			DecidedAt: device.ConsentedAt, Policy: device.PolicyVersion,
		})
	}
	return winners
}

func LoadLatestRowsByType(ctx context.Context, client *ent.Client, subject models.Subject) (map[string]*ent.UserConsent, error) {
	rows := map[string]*ent.UserConsent{}
	for _, consentType := range models.OptionalConsentTypes {
		row, err := LatestConsentRow(ctx, client, subject, consentType)
		if err != nil {
			return nil, err
		}
		if row != nil {
			rows[consentType] = row
		}
	}
	return rows, nil
}

func AccountSubject(accountId uuid.UUID) models.Subject {
	return models.Subject{AccountId: &accountId}
}
