package controllers

import (
	"crypto/subtle"
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/platform/httpserver"
)

var (
	currencyPattern = regexp.MustCompile(`^[A-Z]{3}$`)
	countryPattern  = regexp.MustCompile(`^[A-Z]{2}$`)
)

type SellerMoneyController struct {
	Application *sellermoney.Application
}

func (controller SellerMoneyController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Payouts.Container.Resources.Logger, err)
}

func (controller SellerMoneyController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller SellerMoneyController) Internal(next func(http.ResponseWriter, *http.Request, dtos.SellerContext)) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		expected := controller.Application.Payouts.Container.Settings.InternalApiToken
		if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
			httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
			return
		}
		seller, err := readSellerContext(request)
		if err != nil {
			controller.fail(writer, request, err)
			return
		}
		next(writer, request, seller)
	}
}

func readSellerContext(request *http.Request) (dtos.SellerContext, error) {
	sellerId, sellerError := uuid.Parse(request.PathValue("sellerId"))
	storeId, storeError := uuid.Parse(request.Header.Get("X-Seller-Store-Id"))
	currency, country := request.Header.Get("X-Store-Currency"), request.Header.Get("X-Store-Country")
	location, zoneError := time.LoadLocation(request.Header.Get("X-Store-Timezone"))
	if request.Header.Get("X-Store-Timezone") == "" {
		location, zoneError = time.UTC, nil
	}
	if sellerError != nil || storeError != nil || !currencyPattern.MatchString(currency) || !countryPattern.MatchString(country) || zoneError != nil {
		return dtos.SellerContext{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "seller", Message: "the seller context is incomplete"}})
	}
	return dtos.SellerContext{
		SellerId: sellerId.String(), StoreId: storeId, StoreName: request.Header.Get("X-Store-Name"), Currency: currency, CountryCode: country,
		Location: location, ActorId: request.Header.Get("X-Actor-Id"),
	}, nil
}

func pathIdentifier(request *http.Request, name string) (uuid.UUID, error) {
	identifier, err := uuid.Parse(request.PathValue(name))
	if err != nil {
		return uuid.Nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be a valid id"}})
	}
	return identifier, nil
}

func decode[Body any](writer http.ResponseWriter, request *http.Request, validate func(Body) error) (Body, error) {
	var body Body
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}
