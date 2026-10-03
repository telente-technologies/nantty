package dtos

import (
	"time"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/modules/consents/models"
	getconsentstates "zudomart/modules/users/src/modules/consents/queries/getConsentStates"
)

type SetConsentsRequest struct {
	DeviceId        *string         `json:"deviceId"`
	PolicyVersion   *string         `json:"policyVersion"`
	PolicyVersionId *string         `json:"policyVersionId"`
	Decisions       map[string]bool `json:"decisions"`
	Consents        map[string]bool `json:"consents"`
}

type MergeConsentsRequest struct {
	DeviceId string `json:"deviceId"`
}

type AcceptTermsRequest struct {
	TermsVersion string `json:"termsVersion"`
}

type PublishPolicyVersionRequest struct {
	Kind        string `json:"kind"`
	Version     string `json:"version"`
	EffectiveAt string `json:"effectiveAt"`
	Summary     string `json:"summary"`
	ContentUrl  string `json:"contentUrl"`
}

type ConsentStateResponse struct {
	ConsentType   string  `json:"consentType"`
	Status        string  `json:"status"`
	PolicyVersion string  `json:"policyVersion"`
	DecidedAt     *string `json:"decidedAt"`
}

type ConsentsResponse struct {
	Data          []ConsentStateResponse `json:"data"`
	NextCursor    *string                `json:"nextCursor"`
	PolicyVersion string                 `json:"policyVersion"`
	NeedsRenewal  bool                   `json:"needsRenewal"`
	Merged        *int                   `json:"merged,omitempty"`
}

type PolicyVersionResponse struct {
	Kind        string `json:"kind"`
	Version     string `json:"version"`
	EffectiveAt string `json:"effectiveAt"`
	Summary     string `json:"summary"`
	ContentUrl  string `json:"contentUrl"`
}

type TermsAcceptanceResponse struct {
	TermsVersion string `json:"termsVersion"`
	AcceptedAt   string `json:"acceptedAt"`
}

func ConvertConsentResult(result getconsentstates.Result) ConsentsResponse {
	items := make([]ConsentStateResponse, 0, len(result.States))
	for _, state := range result.States {
		item := ConsentStateResponse{ConsentType: state.ConsentType, Status: state.Status, PolicyVersion: state.PolicyVersion}
		if state.DecidedAt != nil {
			formatted := state.DecidedAt.UTC().Format(time.RFC3339)
			item.DecidedAt = &formatted
		}
		items = append(items, item)
	}
	return ConsentsResponse{Data: items, PolicyVersion: result.PolicyVersion, NeedsRenewal: result.NeedsRenewal}
}

func ConvertPolicyVersion(row *ent.PolicyVersion) PolicyVersionResponse {
	return PolicyVersionResponse{Kind: string(row.Kind), Version: row.Version, EffectiveAt: row.EffectiveAt.UTC().Format(time.RFC3339), Summary: row.Summary, ContentUrl: row.ContentURL}
}

func ConvertTermsAcceptance(row *ent.TermsAcceptance) TermsAcceptanceResponse {
	return TermsAcceptanceResponse{TermsVersion: row.TermsVersion, AcceptedAt: row.AcceptedAt.UTC().Format(time.RFC3339)}
}

func DecisionsFromMap(decisions map[string]bool) []models.Decision {
	ordered := make([]models.Decision, 0, len(decisions))
	for _, consentType := range append([]string{models.TypeEssential}, models.OptionalConsentTypes...) {
		if granted, present := decisions[consentType]; present {
			ordered = append(ordered, models.Decision{ConsentType: consentType, Granted: granted})
		}
	}
	return ordered
}
