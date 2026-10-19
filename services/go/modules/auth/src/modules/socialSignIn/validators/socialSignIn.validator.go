package validators

import (
	"zudomart/modules/auth/src/modules/socialSignIn/dtos"
	"zudomart/modules/auth/src/utils"
)

func ValidateGoogleSignInRequest(request dtos.GoogleSignInRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("idToken", request.IdToken, 20, 4096)
	collector.RequireLength("nonce", request.Nonce, 16, 256)
	collector.RequireLength("birthday", request.Birthday, 0, 10)
	return collector.Result()
}

func ValidateAppleSignInRequest(request dtos.AppleSignInRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("identityToken", request.IdentityToken, 20, 4096)
	collector.RequireLength("nonce", request.Nonce, 16, 256)
	collector.RequireLength("birthday", request.Birthday, 0, 10)
	if request.FullName != nil {
		collector.RequireLength("fullName.givenName", utils.DerefOrEmpty(request.FullName.GivenName), 0, 80)
		collector.RequireLength("fullName.familyName", utils.DerefOrEmpty(request.FullName.FamilyName), 0, 80)
	}
	return collector.Result()
}
