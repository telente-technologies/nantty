package controllers

import (
	"net/http"
	"strings"

	"nantty/modules/auth/src/container"
	identity "nantty/modules/auth/src/integrations"
	signinwithsocialprovider "nantty/modules/auth/src/modules/socialSignIn/commands/signInWithSocialProvider"
	"nantty/modules/auth/src/modules/socialSignIn/dtos"
	"nantty/modules/auth/src/modules/socialSignIn/validators"
	"nantty/modules/auth/src/types"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
)

type SocialSignInController struct {
	Container *container.Container
}

func (controller SocialSignInController) SignInWithGoogle(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.GoogleSignInRequest](writer, request, validators.ValidateGoogleSignInRequest)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	controller.finish(writer, request, signinwithsocialprovider.Command{Provider: identity.Google, Token: body.IdToken, Nonce: body.Nonce, Birthday: body.Birthday, Client: utils.ReadClientDetails(request)})
}

func (controller SocialSignInController) SignInWithApple(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.AppleSignInRequest](writer, request, validators.ValidateAppleSignInRequest)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	fullName := ""
	if body.FullName != nil {
		fullName = strings.TrimSpace(utils.DerefOrEmpty(body.FullName.GivenName) + " " + utils.DerefOrEmpty(body.FullName.FamilyName))
	}
	controller.finish(writer, request, signinwithsocialprovider.Command{Provider: identity.Apple, Token: body.IdentityToken, Nonce: body.Nonce, FullName: fullName, Birthday: body.Birthday, Client: utils.ReadClientDetails(request)})
}

func (controller SocialSignInController) finish(writer http.ResponseWriter, request *http.Request, command signinwithsocialprovider.Command) {
	result, err := signinwithsocialprovider.Handler{Container: controller.Container}.Execute(request.Context(), command)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	status := http.StatusOK
	if result.IsNewUser {
		status = http.StatusCreated
	}
	httpserver.WriteJsonResponse(writer, status, types.ConvertAuthenticationResultToSessionResponse(result))
}
