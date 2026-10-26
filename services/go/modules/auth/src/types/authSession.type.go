package types

import (
	"slices"
	"time"

	"nantty/modules/auth/src/generated/ent"
)

type CurrentUserResponse struct {
	Id                 string   `json:"id"`
	Name               string   `json:"name"`
	Username           string   `json:"username"`
	AvatarUrl          *string  `json:"avatarUrl"`
	BannerUrl          *string  `json:"bannerUrl"`
	Bio                string   `json:"bio"`
	Verified           bool     `json:"verified"`
	IsCreator          bool     `json:"isCreator"`
	IsSeller           bool     `json:"isSeller"`
	StoreId            *string  `json:"storeId"`
	Email              *string  `json:"email"`
	Birthday           *string  `json:"birthday"`
	Roles              []string `json:"roles"`
	EmailVerified      bool     `json:"emailVerified"`
	HasPassword        bool     `json:"hasPassword"`
	Followers          int      `json:"followers"`
	Following          int      `json:"following"`
	Posts              int      `json:"posts"`
	JoinedAt           string   `json:"joinedAt"`
	CreatedAt          string   `json:"createdAt"`
	AccountStatus      string   `json:"accountStatus"`
	MustChangePassword bool     `json:"mustChangePassword"`
}

type AuthSessionResponse struct {
	IssuedTokens
	User      CurrentUserResponse `json:"user"`
	IsNewUser bool                `json:"isNewUser"`
	Notice    *string             `json:"notice"`
}

const (
	AccountDeletionCancelledNotice = "Your account deletion has been cancelled"
	AccountReactivatedNotice       = "Welcome back. Your account is active again."
)

func ConvertAuthenticationResultToSessionResponse(result AuthenticationResult) AuthSessionResponse {
	response := AuthSessionResponse{IssuedTokens: result.Tokens, User: ConvertAccountToCurrentUserResponse(result.Account), IsNewUser: result.IsNewUser}
	if result.DeletionCancelled {
		notice := AccountDeletionCancelledNotice
		response.Notice = &notice
	} else if result.Reactivated {
		notice := AccountReactivatedNotice
		response.Notice = &notice
	}
	return response
}

func ConvertAccountToCurrentUserResponse(account *ent.Account) CurrentUserResponse {
	var birthday *string
	if account.Birthday != nil {
		formatted := account.Birthday.Format(time.DateOnly)
		birthday = &formatted
	}
	joinedAt := account.CreatedAt.UTC().Format(time.RFC3339)
	return CurrentUserResponse{
		Id: account.ID.String(), Name: account.Name, Username: account.Username, Email: account.Email, Birthday: birthday, Roles: account.Roles,
		IsCreator: slices.Contains(account.Roles, "creator"), IsSeller: slices.Contains(account.Roles, "seller"), EmailVerified: account.EmailVerifiedAt != nil, HasPassword: account.PasswordHash != nil,
		JoinedAt: joinedAt, CreatedAt: joinedAt, AccountStatus: string(account.Status), MustChangePassword: account.MustChangePassword,
	}
}
