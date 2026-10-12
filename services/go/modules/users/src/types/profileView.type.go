package types

import (
	"strings"
	"time"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/platform/identityports"
)

type UserView struct {
	Id               string   `json:"id"`
	ProfileId        string   `json:"profileId"`
	Name             string   `json:"name"`
	Username         string   `json:"username"`
	AvatarUrl        *string  `json:"avatarUrl"`
	BannerUrl        *string  `json:"bannerUrl"`
	Bio              string   `json:"bio"`
	Website          *string  `json:"website"`
	Verified         bool     `json:"verified"`
	IsCreator        bool     `json:"isCreator"`
	CreatorStatus    string   `json:"creatorStatus"`
	AccountStatus    string   `json:"accountStatus"`
	IsSeller         bool     `json:"isSeller"`
	ProfileKind      string   `json:"profileKind"`
	ShowsMart        bool     `json:"showsMart"`
	IsPrivate        bool     `json:"isPrivate"`
	StoreId          *string  `json:"storeId"`
	CountryCode      *string  `json:"countryCode"`
	Followers        int      `json:"followers"`
	Following        int      `json:"following"`
	Posts            int      `json:"posts"`
	JoinedAt         string   `json:"joinedAt"`
	CreatedAt        string   `json:"createdAt"`
	Email            *string  `json:"email,omitempty"`
	Birthday         *string  `json:"birthday,omitempty"`
	Roles            []string `json:"roles,omitempty"`
	BirthdayToday    bool     `json:"birthdayToday"`
	AnniversaryToday bool     `json:"anniversaryToday"`
	EmailVerified    *bool    `json:"emailVerified,omitempty"`
	Theme            *string  `json:"theme,omitempty"`
}

type ActingProfileView struct {
	Id           string   `json:"id"`
	Kind         string   `json:"kind"`
	Type         string   `json:"type"`
	Name         string   `json:"name"`
	Handle       string   `json:"handle"`
	AvatarUrl    *string  `json:"avatarUrl"`
	Verification *string  `json:"verification"`
	IsPrivate    bool     `json:"isPrivate"`
	Description  string   `json:"description,omitempty"`
	Website      *string  `json:"website,omitempty"`
	Categories   []string `json:"categories,omitempty"`
	Active       bool     `json:"active"`
	ShowsMart    bool     `json:"showsMart"`
	OnHold       bool     `json:"onHold"`
}

func BuildUserView(row *ent.Profile, summary identityports.AccountSummary, includePrivateFields bool) UserView {
	joinedAt := summary.CreatedAt.UTC().Format(time.RFC3339)
	view := UserView{
		Id: row.AccountID.String(), ProfileId: row.ID.String(), Name: row.DisplayName, Username: row.Handle,
		AvatarUrl: row.AvatarURL, BannerUrl: row.BannerURL, Bio: row.Bio, Website: row.Website,
		Verified: row.Verified, IsCreator: row.CreatorStatus == profile.CreatorStatusApproved, CreatorStatus: string(row.CreatorStatus), AccountStatus: summary.Status, IsSeller: containsRole(summary.Roles, "seller"), IsPrivate: row.IsPrivate,
		CountryCode: row.CountryCode, JoinedAt: joinedAt, CreatedAt: joinedAt,
	}
	if includePrivateFields {
		view.Email, view.Roles = summary.Email, summary.Roles
		theme := string(row.Theme)
		view.Theme = &theme
		verified := summary.EmailVerified
		view.EmailVerified = &verified
		if summary.Birthday != nil {
			birthday := summary.Birthday.Format(time.DateOnly)
			view.Birthday = &birthday
		}
	}
	return view
}

func containsRole(roles []string, wanted string) bool {
	for _, role := range roles {
		if role == wanted {
			return true
		}
	}
	return false
}

func kindForMobile(kind profile.Kind) string {
	if kind == profile.KindPersonal {
		return "person"
	}
	return string(kind)
}

func BuildActingProfileView(row *ent.Profile, activeProfileId string) ActingProfileView {
	view := ActingProfileView{
		Id: row.ID.String(), Kind: kindForMobile(row.Kind), Type: string(row.Kind), Name: row.DisplayName, Handle: row.Handle,
		AvatarUrl: row.AvatarURL, IsPrivate: row.IsPrivate, Description: row.Bio, Website: row.Website, Active: row.ID.String() == activeProfileId,
	}
	for _, category := range row.Edges.Categories {
		view.Categories = append(view.Categories, category.Name)
	}
	return view
}

func trimmedOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
