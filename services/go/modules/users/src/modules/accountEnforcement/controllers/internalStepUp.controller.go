package controllers

import (
	"net/http"
	"strings"

	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

func forwardedStepUpIsValid(registry *identityports.Registry, request *http.Request, staffId string) bool {
	token := strings.TrimSpace(request.Header.Get(staffauth.StepUpHeader))
	if token == "" || staffId == "" {
		return false
	}
	tokens, err := registry.StaffTokenService()
	if err != nil {
		return false
	}
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, tokens.StaffTokenIssuer(), staffauth.StepUpAudience)
	principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), token)
	return err == nil && principal.UserId == staffId
}
