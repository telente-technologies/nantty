package controllers

import (
	"net/http"

	"zudomart/modules/catalog/src/modules/internalSources/dtos"
	getstoremembership "zudomart/modules/catalog/src/modules/internalSources/queries/getStoreMembership"
	resolveproductownership "zudomart/modules/catalog/src/modules/internalSources/queries/resolveProductOwnership"
	"zudomart/modules/catalog/src/utils"
)

const maximumOwnershipProducts = 100

func (controller InternalSourcesController) GetStoreMembership(writer http.ResponseWriter, request *http.Request) {
	storeId, err := utils.PathIdentifier(request, "storeId")
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	accountId, err := utils.PathIdentifier(request, "userId")
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	result, err := (getstoremembership.Handler{Container: controller.Container}).Execute(request.Context(), getstoremembership.Query{StoreId: storeId, AccountId: accountId})
	controller.respond(writer, request, result, err)
}

func (controller InternalSourcesController) ResolveProductOwnership(writer http.ResponseWriter, request *http.Request) {
	storeId, err := utils.PathIdentifier(request, "storeId")
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, func(body dtos.ProductOwnershipRequest) error {
		issues := utils.Issues{}
		if len(body.ProductIds) == 0 || len(body.ProductIds) > maximumOwnershipProducts {
			issues.Add("productIds", "must contain between 1 and 100 ids")
		}
		return issues.AsError()
	})
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	issues := utils.Issues{}
	productIds := utils.ParseIdentifiers("productIds", body.ProductIds, &issues)
	if err := issues.AsError(); err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	result, err := (resolveproductownership.Handler{Container: controller.Container}).Execute(request.Context(), resolveproductownership.Query{StoreId: storeId, ProductIds: productIds})
	controller.respond(writer, request, result, err)
}
