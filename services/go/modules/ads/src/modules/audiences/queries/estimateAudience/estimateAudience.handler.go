package estimateaudience

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adcustomaudience"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/audiences/dtos"
	"nantty/modules/ads/src/modules/audiences/services"
	"nantty/modules/ads/src/modules/audiences/validators"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AudienceEstimate, error) {
	deployed, request := handler.Container, query.Request
	if err := validators.ValidateEstimate(request); err != nil {
		return dtos.AudienceEstimate{}, err
	}
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView); err != nil {
		return dtos.AudienceEstimate{}, err
	}
	sizes, err := handler.customAudienceSizes(ctx, query.AccountId, append(append([]string{}, request.Audience.CustomAudienceIds...), request.Audience.ExcludedCustomAudienceIds...))
	if err != nil {
		return dtos.AudienceEstimate{}, err
	}
	settings := deployed.Settings
	estimate := services.Estimate(request, services.EstimateInputs{
		Population: settings.PopulationByCountry, CustomAudienceSizes: sizes, ReservePerMilleMinor: settings.ReservePerMilleMinor, BaselineCtrPpm: settings.BaselineCtrPpm, Now: deployed.Now(),
	})
	return estimate, nil
}

func (handler Handler) customAudienceSizes(ctx context.Context, accountId uuid.UUID, rawIds []string) (map[string]int64, error) {
	sizes := map[string]int64{}
	if len(rawIds) == 0 {
		return sizes, nil
	}
	ids := make([]uuid.UUID, 0, len(rawIds))
	for _, raw := range rawIds {
		id, err := uuid.Parse(raw)
		if err != nil {
			return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "audience.customAudienceIds", Message: "Unknown audience."}})
		}
		ids = append(ids, id)
	}
	rows, err := handler.Container.Client.AdCustomAudience.Query().Where(adcustomaudience.AccountID(accountId), adcustomaudience.IDIn(ids...)).All(ctx)
	if err != nil {
		return nil, err
	}
	if len(rows) != len(uniqueCount(ids)) {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "audience.customAudienceIds", Message: "Custom audiences must belong to this ad account."}})
	}
	for _, row := range rows {
		if row.Status == adcustomaudience.StatusReady {
			sizes[row.ID.String()] = row.MatchedCount
		}
	}
	return sizes, nil
}

func uniqueCount(ids []uuid.UUID) map[uuid.UUID]struct{} {
	unique := make(map[uuid.UUID]struct{}, len(ids))
	for _, id := range ids {
		unique[id] = struct{}{}
	}
	return unique
}
