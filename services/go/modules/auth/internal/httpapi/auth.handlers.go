package httpapi

import (
	"encoding/json"
	"net/http"

	"zudomart/modules/auth/internal/application"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

func (routes AuthRoutes) registerAccount(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateRegisterRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	result, err := routes.Application.RegisterAccountWithVerifiedEmail(request.Context(), application.RegisterAccountInput{
		Email: body.Email, Birthday: body.Birthday, Password: body.Password, Username: body.Username,
		Name: body.Name, OtpToken: body.OtpToken, Client: readClientDetails(request),
	})
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, ConvertAuthenticationResultToSessionResponse(result))
}

func (routes AuthRoutes) logIn(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateLogInRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	result, err := routes.Application.LogInWithEmailOrUsernameAndPassword(request.Context(), application.LogInWithPasswordInput{
		Identifier: body.Identifier, Password: body.Password, Client: readClientDetails(request),
	})
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, ConvertAuthenticationResultToSessionResponse(result))
}

func (routes AuthRoutes) refreshSessionTokens(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateRefreshRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	tokens, err := routes.Application.RotateRefreshTokenAndDetectReuse(request.Context(), body.RefreshToken)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, tokens)
}

func (routes AuthRoutes) logOut(writer http.ResponseWriter, request *http.Request) {
	var body LogOutRequest
	if request.ContentLength > 0 {
		if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
			routes.respondWithError(writer, request, err)
			return
		}
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	if err := routes.Application.LogOutSessionOwnedByAccount(request.Context(), principal.UserId, principal.SessionId); err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (routes AuthRoutes) sendOneTimeCode(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateSendOneTimeCodeRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	result, err := routes.Application.SendOneTimeCodeWithoutRevealingAccountExistence(request.Context(), application.SendOneTimeCodeInput{Destination: body.Destination, Purpose: body.Purpose})
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (routes AuthRoutes) verifyOneTimeCode(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateVerifyOneTimeCodeRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	result, err := routes.Application.VerifyOneTimeCodeAndIssueVerifiedDestinationToken(request.Context(), application.VerifyOneTimeCodeInput{
		Destination: body.Destination, Code: body.Code, Purpose: body.Purpose,
	})
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (routes AuthRoutes) checkUsernameAvailability(writer http.ResponseWriter, request *http.Request) {
	result, err := routes.Application.CheckUsernameAvailability(request.Context(), request.URL.Query().Get("username"))
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (routes AuthRoutes) serveJsonWebKeySet(writer http.ResponseWriter, request *http.Request) {
	keySet, err := routes.PublishedKeySet(request.Context())
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	encoded, err := json.Marshal(keySet)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	writer.Header().Set("Content-Type", "application/jwk-set+json")
	writer.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = writer.Write(encoded)
}
