package applybulkaction

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	duplicatecampaign "zudomart/modules/ads/src/modules/campaigns/commands/duplicateCampaign"
	submitcampaignforreview "zudomart/modules/ads/src/modules/campaigns/commands/submitCampaignForReview"
	updatead "zudomart/modules/ads/src/modules/campaigns/commands/updateAd"
	updateadset "zudomart/modules/ads/src/modules/campaigns/commands/updateAdSet"
	updatecampaign "zudomart/modules/ads/src/modules/campaigns/commands/updateCampaign"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) dtos.BulkActionResult {
	result := dtos.BulkActionResult{SucceededIds: []string{}, Failed: []dtos.BulkFailure{}}
	for _, rawId := range command.Request.Ids {
		id, err := uuid.Parse(rawId)
		if err == nil {
			err = handler.applyToOne(ctx, command, id)
		}
		if err != nil {
			result.Failed = append(result.Failed, dtos.BulkFailure{Id: rawId, Message: failureMessage(err)})
			continue
		}
		result.SucceededIds = append(result.SucceededIds, rawId)
	}
	return result
}

func failureMessage(err error) string {
	var apiError *httpserver.ApiError
	if errors.As(err, &apiError) {
		return apiError.Message
	}
	return "Could not apply the action."
}

func (handler Handler) applyToOne(ctx context.Context, command Command, id uuid.UUID) error {
	statusTarget := map[string]string{"pause": "paused", "resume": "active", "archive": "completed"}[command.Request.Action]
	switch {
	case command.Request.Action == "submit_for_review" && command.Request.Level == "campaign":
		_, err := (submitcampaignforreview.Handler{Container: handler.Container}).Execute(ctx, submitcampaignforreview.Command{AccountId: command.AccountId, CampaignId: id, UserId: command.UserId})
		return err
	case command.Request.Action == "duplicate" && command.Request.Level == "campaign":
		_, err := (duplicatecampaign.Handler{Container: handler.Container}).Execute(ctx, duplicatecampaign.Command{AccountId: command.AccountId, CampaignId: id, UserId: command.UserId})
		return err
	case statusTarget == "completed":
		return handler.archive(ctx, command, id)
	case statusTarget != "":
		return handler.changeStatus(ctx, command, id, statusTarget)
	}
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "action", Message: "This action is not available for " + command.Request.Level + "s."}})
}

func (handler Handler) changeStatus(ctx context.Context, command Command, id uuid.UUID, target string) error {
	switch command.Request.Level {
	case "campaign":
		_, err := (updatecampaign.Handler{Container: handler.Container}).Execute(ctx, updatecampaign.Command{AccountId: command.AccountId, CampaignId: id, UserId: command.UserId, Patch: dtos.CampaignPatch{Status: &target}})
		return err
	case "ad_set":
		_, err := (updateadset.Handler{Container: handler.Container}).Execute(ctx, updateadset.Command{AccountId: command.AccountId, AdSetId: id, UserId: command.UserId, Patch: dtos.AdSetPatch{Status: &target}})
		return err
	default:
		_, err := (updatead.Handler{Container: handler.Container}).Execute(ctx, updatead.Command{AccountId: command.AccountId, AdId: id, UserId: command.UserId, Patch: dtos.AdPatch{Status: &target}})
		return err
	}
}
