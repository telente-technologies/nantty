package services

import (
	"context"

	"github.com/google/uuid"

	"time"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/legalversion"
	"zudomart/modules/users/src/generated/ent/termsacceptance"
)

type PolicyGate struct {
	AcceptanceRequired bool     `json:"acceptanceRequired"`
	DocumentKeys       []string `json:"documentKeys"`
}

func EvaluatePolicyGate(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time) (PolicyGate, error) {
	gate := PolicyGate{DocumentKeys: []string{}}
	due, err := client.LegalVersion.Query().Where(legalversion.StatusEQ(legalversion.StatusPublished), legalversion.IsMaterialChange(true), legalversion.EffectiveAtLTE(now)).All(ctx)
	if err != nil {
		return gate, err
	}
	for _, version := range due {
		accepted, err := client.TermsAcceptance.Query().Where(termsacceptance.AccountID(accountId), termsacceptance.PolicyVersionID(version.ID)).Exist(ctx)
		if err != nil {
			return gate, err
		}
		if !accepted {
			gate.AcceptanceRequired = true
			gate.DocumentKeys = append(gate.DocumentKeys, version.DocumentKey)
		}
	}
	return gate, nil
}
