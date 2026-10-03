package httpapi

import (
	"net/http"
	"strings"

	"zudomart/modules/auth/internal/application"
	identity "zudomart/modules/auth/internal/socialidentity"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

func (routes AuthRoutes) resetPassword(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateResetPasswordRequest)
	if err == nil {
		err = routes.Application.ResetPasswordWithVerifiedCode(request.Context(), application.ResetPasswordInput{OtpToken: body.OtpToken, NewPassword: body.Password})
	}
	routes.respondNoContentOrError(writer, request, err)
}

func (routes AuthRoutes) changePassword(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateChangePasswordRequest)
	if err == nil {
		principal, _ := jwtauth.PrincipalFromContext(request.Context())
		err = routes.Application.ChangePasswordKeepingCurrentSession(request.Context(), application.ChangePasswordInput{
			AccountId: principal.UserId, SessionId: principal.SessionId, CurrentPassword: body.CurrentPassword, NewPassword: body.NewPassword,
		})
	}
	routes.respondNoContentOrError(writer, request, err)
}

func (routes AuthRoutes) signInWithGoogle(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateGoogleSignInRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	routes.finishSocialSignIn(writer, request, application.SocialSignInInput{Provider: identity.Google, Token: body.IdToken, Nonce: body.Nonce, Client: readClientDetails(request)})
}

func (routes AuthRoutes) signInWithApple(writer http.ResponseWriter, request *http.Request) {
	body, err := decodeAndValidate(writer, request, ValidateAppleSignInRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	fullName := ""
	if body.FullName != nil {
		fullName = strings.TrimSpace(derefOrEmpty(body.FullName.GivenName) + " " + derefOrEmpty(body.FullName.FamilyName))
	}
	routes.finishSocialSignIn(writer, request, application.SocialSignInInput{Provider: identity.Apple, Token: body.IdentityToken, Nonce: body.Nonce, FullName: fullName, Client: readClientDetails(request)})
}

func (routes AuthRoutes) finishSocialSignIn(writer http.ResponseWriter, request *http.Request, input application.SocialSignInInput) {
	result, err := routes.Application.SignInWithVerifiedSocialIdentity(request.Context(), input)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	status := http.StatusOK
	if result.IsNewUser {
		status = http.StatusCreated
	}
	httpserver.WriteJsonResponse(writer, status, ConvertAuthenticationResultToSessionResponse(result))
}

func (routes AuthRoutes) listActiveSessions(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	page, err := routes.Application.ListActiveSessionsOfAccount(request.Context(), principal.UserId, principal.SessionId, request.URL.Query().Get("cursor"))
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (routes AuthRoutes) revokeSession(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	routes.respondNoContentOrError(writer, request, routes.Application.RevokeOwnedSession(request.Context(), principal.UserId, request.PathValue("sessionId")))
}

func (routes AuthRoutes) revokeOtherSessions(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	_, err := routes.Application.RevokeAllSessionsExceptCurrent(request.Context(), principal.UserId, principal.SessionId)
	routes.respondNoContentOrError(writer, request, err)
}

func (routes AuthRoutes) respondNoContentOrError(writer http.ResponseWriter, request *http.Request, err error) {
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
