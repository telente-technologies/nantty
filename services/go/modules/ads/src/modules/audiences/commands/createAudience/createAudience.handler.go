package createaudience

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcustomaudience"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/audiences/dtos"
	"nantty/modules/ads/src/modules/audiences/services"
	"nantty/modules/ads/src/modules/audiences/validators"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.CustomAudience, error) {
	deployed, request := handler.Container, command.Request
	if err := validators.ValidateCreate(request); err != nil {
		return dtos.CustomAudience{}, err
	}
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionAudiencesManage)
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	if request.Type == "store_customers" && account.StoreID == "" {
		return dtos.CustomAudience{}, validation("type", "Link a store to this ad account to use store customers.")
	}
	create := deployed.Client.AdCustomAudience.Create().SetAccountID(account.ID).SetName(strings.TrimSpace(request.Name)).SetType(adcustomaudience.Type(request.Type))
	params, _ := json.Marshal(request)
	create.SetParams(params)
	if request.RetentionDays != nil {
		create.SetRetentionDays(*request.RetentionDays)
	}
	var lookalikeSize int64
	if request.Type == "lookalike" {
		if lookalikeSize, err = handler.prepareLookalike(ctx, create, account.ID, request); err != nil {
			return dtos.CustomAudience{}, err
		}
	}
	row, err := create.Save(ctx)
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	if request.Type == "lookalike" {
		row, err = services.FinishBuilding(ctx, deployed.Client, row, lookalikeSize, nil)
	} else {
		row, err = handler.buildFromSource(ctx, row, account, request)
	}
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	return services.PresentAudience(row, 0), nil
}

func (handler Handler) buildFromSource(ctx context.Context, row *ent.AdCustomAudience, account *ent.AdAccount, request dtos.CreateAudienceRequest) (*ent.AdCustomAudience, error) {
	userIds, resolveErr := services.ResolveMembers(ctx, handler.Container, account, request)
	var matched int64
	if resolveErr == nil {
		var storeErr error
		if matched, storeErr = services.StoreMembers(ctx, handler.Container.Client, row.ID, userIds); storeErr != nil {
			return nil, storeErr
		}
	}
	return services.FinishBuilding(ctx, handler.Container.Client, row, matched, resolveErr)
}

func (handler Handler) prepareLookalike(ctx context.Context, create *ent.AdCustomAudienceCreate, accountId uuid.UUID, request dtos.CreateAudienceRequest) (int64, error) {
	sourceId, err := uuid.Parse(request.SourceAudienceId)
	if err != nil {
		return 0, validation("sourceAudienceId", "Choose a source audience.")
	}
	source, err := services.LoadAudienceInAccount(ctx, handler.Container.Client, accountId, sourceId)
	if err != nil {
		return 0, err
	}
	if source.Type == adcustomaudience.TypeLookalike {
		return 0, validation("sourceAudienceId", "A lookalike cannot be built from another lookalike.")
	}
	if source.Status != adcustomaudience.StatusReady {
		return 0, validation("sourceAudienceId", "The source audience must be ready and have at least 100 people.")
	}
	country := strings.ToUpper(request.CountryCode)
	create.SetLookalikeSourceID(sourceId).SetLookalikeCountryCode(country).SetLookalikeSimilarityPercent(*request.SimilarityPercent)
	return services.LookalikeSize(handler.Container.Settings.PopulationByCountry[country], *request.SimilarityPercent), nil
}

func validation(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}
