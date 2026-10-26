package controllers

import (
	"github.com/google/uuid"
	audienceservices "nantty/modules/ads/src/modules/audiences/services"
	"net/http"

	"nantty/modules/ads/src/container"
	decideadforslot "nantty/modules/ads/src/modules/decision/commands/decideAdForSlot"
	upsertcontentsignal "nantty/modules/ads/src/modules/decision/commands/upsertContentSignal"
	"nantty/modules/ads/src/modules/decision/dtos"
	"nantty/modules/ads/src/modules/decision/validators"
	"nantty/modules/ads/src/types"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

type DecisionController struct{ Container *container.Container }

func (controller DecisionController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller DecisionController) DecideForSignedInViewer(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		var body dtos.DecideRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := validators.ValidateSlot(body.Slot, body.SessionId); err != nil {
			return err
		}
		viewer := types.Viewer{UserId: userId.String(), Country: utils.TrustedViewerCountry(request)}
		if body.Viewer != nil {
			viewer.Region, viewer.AgeBand, viewer.Gender, viewer.Topics, viewer.CustomAudienceIds = body.Viewer.Region, body.Viewer.AgeBand, body.Viewer.Gender, body.Viewer.Topics, body.Viewer.CustomAudienceIds
		}
		return controller.decide(writer, request, decideadforslot.Command{UserId: userId.String(), SessionId: body.SessionId, Slot: body.Slot, Viewer: viewer})
	})
}

func (controller DecisionController) DecideForTrustedCaller(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		var body dtos.InternalDecideRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := validators.ValidateInternal(body); err != nil {
			return err
		}
		viewer := types.Viewer{UserId: body.UserId, Country: body.Viewer.Country, Region: body.Viewer.Region, AgeBand: body.Viewer.AgeBand, Gender: body.Viewer.Gender, Topics: body.Viewer.Topics, CustomAudienceIds: body.Viewer.CustomAudienceIds, PremiumAdFree: body.Viewer.PremiumAdFree}
		command := decideadforslot.Command{UserId: body.UserId, SessionId: body.SessionId, Slot: body.Slot, Viewer: viewer}
		if body.Content != nil {
			signal := signalFromDto(*body.Content)
			command.TrustedSignal = &signal
		}
		return controller.decide(writer, request, command)
	})
}

func (controller DecisionController) decide(writer http.ResponseWriter, request *http.Request, command decideadforslot.Command) error {
	if len(command.Viewer.CustomAudienceIds) == 0 {
		if userId, err := uuid.Parse(command.UserId); err == nil {
			command.Viewer.CustomAudienceIds, _ = audienceservices.AudienceIdsContaining(request.Context(), controller.Container.Client, userId)
		}
	}
	result, err := (decideadforslot.Handler{Container: controller.Container}).Execute(request.Context(), command)
	if err != nil {
		return err
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.DecideResponse{Ad: result.Ad, DeclinedReason: result.DeclinedReason})
	return nil
}

func (controller DecisionController) UpsertContentSignal(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		var body dtos.InternalContentSignal
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := upsertcontentsignal.Validate(body); err != nil {
			return err
		}
		if err := (upsertcontentsignal.Handler{Container: controller.Container}).Execute(request.Context(), signalFromDto(body)); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func signalFromDto(dto dtos.InternalContentSignal) types.ContentSignal {
	return types.ContentSignal{
		ContentId: dto.ContentId, CreatorUserId: dto.CreatorUserId, ContentKind: dto.ContentKind, DurationSeconds: dto.DurationSeconds, BrandSafe: dto.BrandSafe,
		Sensitive: dto.Sensitive, KidsContent: dto.KidsContent, AiGenerated: dto.AiGenerated, MonetizationEligible: dto.MonetizationEligible,
		OptedInPlacements: dto.OptedInPlacements, Topics: dto.Topics,
	}
}
