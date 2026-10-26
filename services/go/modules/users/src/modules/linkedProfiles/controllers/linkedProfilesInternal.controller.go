package controllers

import (
	"net/http"

	"github.com/google/uuid"

	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/linkedprofile"
	transferbrand "nantty/modules/users/src/modules/linkedProfiles/commands/transferBrand"
	"nantty/modules/users/src/modules/linkedProfiles/dtos"
	"nantty/modules/users/src/modules/linkedProfiles/services"
	usersservices "nantty/modules/users/src/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type claimResult struct {
	Kind      string  `json:"kind"`
	ProfileId string  `json:"profileId"`
	StoreId   *string `json:"storeId"`
	Status    string  `json:"status"`
}

func (controller LinkedProfilesController) trusted(writer http.ResponseWriter, request *http.Request) bool {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || !utils.SecretsMatch(expected, request.Header.Get("X-Internal-Token")) {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return false
	}
	return true
}

func (controller LinkedProfilesController) InternalSummary(writer http.ResponseWriter, request *http.Request) {
	if !controller.trusted(writer, request) {
		return
	}
	accountId, err := pathAccount(request, "accountId")
	var summary services.Summary
	if err == nil {
		summary, err = services.BuildSummary(request.Context(), controller.Container, accountId)
	}
	controller.respond(writer, request, http.StatusOK, summary, err)
}

func (controller LinkedProfilesController) decodeClaim(writer http.ResponseWriter, request *http.Request) (usersservices.LinkedClaim, error) {
	accountId, err := pathAccount(request, "accountId")
	if err != nil {
		return usersservices.LinkedClaim{}, err
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ClaimRequest])
	if err != nil {
		return usersservices.LinkedClaim{}, err
	}
	profileId, err := uuid.Parse(body.ProfileId)
	kind := linkedprofile.Kind(body.Kind)
	if err != nil || linkedprofile.KindValidator(kind) != nil {
		return usersservices.LinkedClaim{}, usersErrors.ValidationFailedFor("kind", "must be store, business or brand with a profile id")
	}
	claim := usersservices.LinkedClaim{AccountId: accountId, Kind: kind, ProfileId: profileId}
	if body.StoreId != nil {
		storeId, err := uuid.Parse(*body.StoreId)
		if err != nil {
			return usersservices.LinkedClaim{}, usersErrors.ValidationFailedFor("storeId", "must be a uuid")
		}
		claim.StoreId = &storeId
	}
	return claim, nil
}

func (controller LinkedProfilesController) InternalClaim(writer http.ResponseWriter, request *http.Request) {
	if !controller.trusted(writer, request) {
		return
	}
	claim, err := controller.decodeClaim(writer, request)
	var claimed *ent.LinkedProfile
	if err == nil {
		err = controller.Container.RunInTransaction(request.Context(), func(tx *ent.Tx) error {
			var claimErr error
			claimed, claimErr = usersservices.ClaimLinkedProfile(request.Context(), tx, claim)
			return claimErr
		})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result := claimResult{Kind: string(claimed.Kind), ProfileId: claimed.ProfileID.String(), Status: string(claimed.Status)}
	if claimed.StoreID != nil {
		storeId := claimed.StoreID.String()
		result.StoreId = &storeId
	}
	controller.respond(writer, request, http.StatusOK, result, nil)
}

func (controller LinkedProfilesController) InternalRelease(writer http.ResponseWriter, request *http.Request) {
	if !controller.trusted(writer, request) {
		return
	}
	claim, err := controller.decodeClaim(writer, request)
	if err == nil {
		err = controller.Container.RunInTransaction(request.Context(), func(tx *ent.Tx) error {
			return usersservices.ReleaseLinkedProfile(request.Context(), tx, claim)
		})
	}
	controller.respond(writer, request, http.StatusNoContent, nil, err)
}

func (controller LinkedProfilesController) InternalTransferBrand(writer http.ResponseWriter, request *http.Request) {
	if !controller.trusted(writer, request) {
		return
	}
	toAccountId, err := pathAccount(request, "accountId")
	var body dtos.TransferBrandRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, acceptAny[dtos.TransferBrandRequest])
	}
	if err == nil {
		brandId, brandErr := uuid.Parse(body.BrandId)
		fromAccountId, fromErr := uuid.Parse(body.FromAccountId)
		if brandErr != nil || fromErr != nil {
			err = usersErrors.ValidationFailedFor("brandId", "brandId and fromAccountId must be uuids")
		} else {
			err = transferbrand.Handler{Container: controller.Container}.Execute(request.Context(), transferbrand.Command{BrandId: brandId, FromAccountId: fromAccountId, ToAccountId: toAccountId})
		}
	}
	controller.respond(writer, request, http.StatusNoContent, nil, err)
}
