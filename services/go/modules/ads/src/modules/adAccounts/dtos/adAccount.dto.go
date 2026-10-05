package dtos

import "zudomart/modules/ads/src/types"

type LinkedBusinessProfile struct {
	StoreId      string  `json:"storeId"`
	StoreName    string  `json:"storeName"`
	Handle       string  `json:"handle"`
	LogoUrl      *string `json:"logoUrl"`
	GoldVerified bool    `json:"goldVerified"`
	CountryCode  string  `json:"countryCode"`
}

type AdAccountSummary struct {
	Id                  string                 `json:"id"`
	Name                string                 `json:"name"`
	Kind                string                 `json:"kind"`
	Currency            string                 `json:"currency"`
	Timezone            string                 `json:"timezone"`
	CountryCode         string                 `json:"countryCode"`
	Status              string                 `json:"status"`
	MyRole              string                 `json:"myRole"`
	VerifiedBusiness    bool                   `json:"verifiedBusiness"`
	Business            *LinkedBusinessProfile `json:"business"`
	Balance             types.Money            `json:"balance"`
	ActiveCampaignCount int                    `json:"activeCampaignCount"`
}

type AccountOwner struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type AdAccount struct {
	AdAccountSummary
	CreatedAt      string       `json:"createdAt"`
	Owner          AccountOwner `json:"owner"`
	AmountSpent    types.Money  `json:"amountSpent"`
	DisabledReason *string      `json:"disabledReason"`
}

type CreateAdAccountRequest struct {
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	StoreId     *string `json:"storeId"`
	CountryCode string  `json:"countryCode"`
	Timezone    string  `json:"timezone"`
}

type UpdateAdAccountRequest struct {
	Name     *string `json:"name"`
	Timezone *string `json:"timezone"`
}

type AdAccountMembership struct {
	AccountId string `json:"accountId"`
	Role      string `json:"role"`
}

type AdAccountMember struct {
	UserId       string  `json:"userId"`
	Name         string  `json:"name"`
	Username     string  `json:"username"`
	AvatarUrl    *string `json:"avatarUrl"`
	Role         string  `json:"role"`
	AddedAt      string  `json:"addedAt"`
	LastActiveAt *string `json:"lastActiveAt"`
	IsOwner      bool    `json:"isOwner"`
}

type AdAccountInvite struct {
	Id        string `json:"id"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	InvitedBy string `json:"invitedBy"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
	ExpiresAt string `json:"expiresAt"`
}

type InvitePreview struct {
	AccountName string `json:"accountName"`
	Role        string `json:"role"`
	InvitedBy   string `json:"invitedBy"`
	ExpiresAt   string `json:"expiresAt"`
}

type ActivityEntry struct {
	Id         string `json:"id"`
	ObjectType string `json:"objectType"`
	ObjectId   string `json:"objectId"`
	Actor      string `json:"actor"`
	Summary    string `json:"summary"`
	Changes    any    `json:"changes"`
	CreatedAt  string `json:"createdAt"`
}

type AdsEntitlements struct {
	GoldPremium      bool         `json:"goldPremium"`
	VerifiedBusiness bool         `json:"verifiedBusiness"`
	MonthlyAdCredit  *types.Money `json:"monthlyAdCredit"`
	CreditRenewsAt   *string      `json:"creditRenewsAt"`
}

type ChangeRoleRequest struct {
	Role string `json:"role"`
}

type InviteMemberRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

type PendingInvite struct {
	Id          string `json:"id"`
	AccountName string `json:"accountName"`
	Role        string `json:"role"`
	InvitedBy   string `json:"invitedBy"`
	ExpiresAt   string `json:"expiresAt"`
}
