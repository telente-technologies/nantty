package httpapi

import (
	"slices"
	"time"

	"zudomart/modules/auth/internal/application"
	"zudomart/modules/auth/internal/ent"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Birthday string `json:"birthday"`
	Password string `json:"password"`
	Username string `json:"username"`
	Name     string `json:"name"`
	OtpToken string `json:"otpToken"`
}

type LogInRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type LogOutRequest struct {
	RefreshToken *string `json:"refreshToken"`
}

type SendOneTimeCodeRequest struct {
	Destination string `json:"destination"`
	Purpose     string `json:"purpose"`
}

type VerifyOneTimeCodeRequest struct {
	Destination string `json:"destination"`
	Code        string `json:"code"`
	Purpose     string `json:"purpose"`
}

type CurrentUserResponse struct {
	Id            string   `json:"id"`
	Name          string   `json:"name"`
	Username      string   `json:"username"`
	AvatarUrl     *string  `json:"avatarUrl"`
	BannerUrl     *string  `json:"bannerUrl"`
	Bio           string   `json:"bio"`
	Verified      bool     `json:"verified"`
	IsCreator     bool     `json:"isCreator"`
	IsSeller      bool     `json:"isSeller"`
	StoreId       *string  `json:"storeId"`
	Email         *string  `json:"email"`
	Phone         *string  `json:"phone"`
	Birthday      *string  `json:"birthday"`
	Roles         []string `json:"roles"`
	EmailVerified bool     `json:"emailVerified"`
	HasPassword   bool     `json:"hasPassword"`
	Followers     int      `json:"followers"`
	Following     int      `json:"following"`
	Posts         int      `json:"posts"`
	JoinedAt      string   `json:"joinedAt"`
	CreatedAt     string   `json:"createdAt"`
}

type AuthSessionResponse struct {
	application.IssuedTokens
	User      CurrentUserResponse `json:"user"`
	IsNewUser bool                `json:"isNewUser"`
}

func ConvertAuthenticationResultToSessionResponse(result application.AuthenticationResult) AuthSessionResponse {
	return AuthSessionResponse{IssuedTokens: result.Tokens, User: ConvertAccountToCurrentUserResponse(result.Account), IsNewUser: result.IsNewUser}
}

func ConvertAccountToCurrentUserResponse(account *ent.Account) CurrentUserResponse {
	var birthday *string
	if account.Birthday != nil {
		formatted := account.Birthday.Format(time.DateOnly)
		birthday = &formatted
	}
	joinedAt := account.CreatedAt.UTC().Format(time.RFC3339)
	return CurrentUserResponse{
		Id:            account.ID.String(),
		Name:          account.Name,
		Username:      account.Username,
		Email:         account.Email,
		Birthday:      birthday,
		Roles:         account.Roles,
		IsSeller:      slices.Contains(account.Roles, "seller"),
		EmailVerified: account.EmailVerifiedAt != nil,
		HasPassword:   account.PasswordHash != nil,
		JoinedAt:      joinedAt,
		CreatedAt:     joinedAt,
	}
}
