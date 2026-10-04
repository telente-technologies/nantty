package dtos

type UserSearchSource struct {
	AccountId     string         `json:"accountId"`
	Username      string         `json:"username"`
	DisplayName   string         `json:"displayName"`
	Bio           string         `json:"bio"`
	AvatarUrl     *string        `json:"avatarUrl"`
	Verified      bool           `json:"verified"`
	Verification  map[string]any `json:"verification"`
	IsCreator     bool           `json:"isCreator"`
	IsPrivate     bool           `json:"isPrivate"`
	Status        string         `json:"status"`
	FollowerCount int            `json:"followerCount"`
	CreatedAt     string         `json:"createdAt"`
}
