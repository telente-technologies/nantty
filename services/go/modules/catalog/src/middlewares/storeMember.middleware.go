package middlewares

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/sellerplans"
)

type storeAccessContextKey struct{}

func StoreAccessFrom(ctx context.Context) commerceports.StoreAccess {
	access, _ := ctx.Value(storeAccessContextKey{}).(commerceports.StoreAccess)
	return access
}

func AccountIdFrom(ctx context.Context) uuid.UUID {
	principal, _ := jwtauth.PrincipalFromContext(ctx)
	identifier, _ := uuid.Parse(principal.UserId)
	return identifier
}

var errNotStoreMember = httpserver.NewApiError(http.StatusForbidden, "NOT_STORE_MEMBER", "You are not a member of this store.")
var errStoreCannotSell = httpserver.NewApiError(http.StatusForbidden, "STORE_NOT_APPROVED", "Your store is not approved to sell right now. Check your seller status.")
var errMissingPermission = httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "You do not have permission to do that.")

func StoreMember(deployed *container.Container, permission string, requireKey bool) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		authenticate := Authenticated(deployed)
		if requireKey {
			authenticate = Idempotent(deployed)
		}
		return authenticate(func(writer http.ResponseWriter, request *http.Request) {
			access, err := resolveStoreAccess(deployed, request, permission)
			if err != nil {
				httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
				return
			}
			handler(writer, request.WithContext(context.WithValue(request.Context(), storeAccessContextKey{}, access)))
		})
	}
}

func resolveStoreAccess(deployed *container.Container, request *http.Request, permission string) (commerceports.StoreAccess, error) {
	catalog, err := commerceports.Default.CatalogReader()
	if err != nil {
		return commerceports.StoreAccess{}, err
	}
	var requestedStore *uuid.UUID
	if header := request.Header.Get("X-Seller-Store"); header != "" {
		parsed, parseError := uuid.Parse(header)
		if parseError != nil {
			return commerceports.StoreAccess{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "X-Seller-Store", Message: "must be a valid id"}})
		}
		requestedStore = &parsed
	}
	access, found, err := catalog.FindStoreAccessForAccount(request.Context(), AccountIdFrom(request.Context()), requestedStore)
	if err != nil {
		return commerceports.StoreAccess{}, err
	}
	if !found {
		return commerceports.StoreAccess{}, errNotStoreMember
	}
	if !access.Allows(permission) {
		return commerceports.StoreAccess{}, errMissingPermission
	}
	return access, nil
}

func StoreMemberFeature(deployed *container.Container, permission, feature string, requireKey bool) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		authenticate := Authenticated(deployed)
		if requireKey {
			authenticate = Idempotent(deployed)
		}
		return authenticate(func(writer http.ResponseWriter, request *http.Request) {
			access, err := resolveStoreAccess(deployed, request, permission)
			if err != nil {
				httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
				return
			}
			if !sellerplans.Default.RequireFeature(writer, request, access.OwnerAccountId, feature) {
				return
			}
			handler(writer, request.WithContext(context.WithValue(request.Context(), storeAccessContextKey{}, access)))
		})
	}
}

func SellingStoreMember(deployed *container.Container, permission string) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return Authenticated(deployed)(func(writer http.ResponseWriter, request *http.Request) {
			access, err := resolveStoreAccess(deployed, request, permission)
			if err == nil && !access.CanSell() {
				err = errStoreCannotSell
			}
			if err != nil {
				httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
				return
			}
			handler(writer, request.WithContext(context.WithValue(request.Context(), storeAccessContextKey{}, access)))
		})
	}
}

func StoreMemberWithOptionalKey(deployed *container.Container, permission string) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return OptionallyIdempotent(deployed)(func(writer http.ResponseWriter, request *http.Request) {
			access, err := resolveStoreAccess(deployed, request, permission)
			if err != nil {
				httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
				return
			}
			handler(writer, request.WithContext(context.WithValue(request.Context(), storeAccessContextKey{}, access)))
		})
	}
}

func StoreMemberFeatureWithOptionalKey(deployed *container.Container, permission, feature string) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return OptionallyIdempotent(deployed)(func(writer http.ResponseWriter, request *http.Request) {
			access, err := resolveStoreAccess(deployed, request, permission)
			if err != nil {
				httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
				return
			}
			if !sellerplans.Default.RequireFeature(writer, request, access.OwnerAccountId, feature) {
				return
			}
			handler(writer, request.WithContext(context.WithValue(request.Context(), storeAccessContextKey{}, access)))
		})
	}
}
