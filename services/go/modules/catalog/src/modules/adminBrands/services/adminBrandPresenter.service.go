package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/databases/schema"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/brandofficialrequest"
	"nantty/modules/catalog/src/generated/ent/store"
	catalogservices "nantty/modules/catalog/src/services"
)

type BrandSummary struct {
	Id                         string         `json:"id"`
	Name                       string         `json:"name"`
	Slug                       string         `json:"slug"`
	LogoUrl                    *string        `json:"logoUrl"`
	Category                   string         `json:"category"`
	Country                    string         `json:"country"`
	Website                    *string        `json:"website"`
	Status                     string         `json:"status"`
	OfficialStatus             string         `json:"officialStatus"`
	Owner                      map[string]any `json:"owner"`
	MemberCount                int            `json:"memberCount"`
	LinkedStoreCount           int            `json:"linkedStoreCount"`
	OpenClaimCount             int            `json:"openClaimCount"`
	CreatedAt                  time.Time      `json:"createdAt"`
	OfficialRequestSubmittedAt *time.Time     `json:"officialRequestSubmittedAt"`
}

type BrandMember struct {
	User    map[string]any `json:"user"`
	Role    string         `json:"role"`
	AddedAt time.Time      `json:"addedAt"`
}

type LinkedStore struct {
	Id               string         `json:"id"`
	StoreName        string         `json:"storeName"`
	Seller           map[string]any `json:"seller"`
	LinkedAt         time.Time      `json:"linkedAt"`
	IsVerified       bool           `json:"isVerified"`
	HasOfficialBadge bool           `json:"hasOfficialBadge"`
}

type RequestDocument struct {
	Id         string    `json:"id"`
	Kind       string    `json:"kind"`
	Label      string    `json:"label"`
	UploadedAt time.Time `json:"uploadedAt"`
}

type OfficialRequest struct {
	Id                    string                `json:"id"`
	SubmittedAt           time.Time             `json:"submittedAt"`
	SubmittedBy           map[string]any        `json:"submittedBy"`
	Trademark             schema.BrandTrademark `json:"trademark"`
	CacRegistrationNumber string                `json:"cacRegistrationNumber"`
	CacCompanyName        string                `json:"cacCompanyName"`
	ContactEmail          string                `json:"contactEmail"`
	Documents             []RequestDocument     `json:"documents"`
	Checks                []OfficialCheck       `json:"checks"`
	LastDecisionReason    *string               `json:"lastDecisionReason"`
	DecidedAt             *time.Time            `json:"decidedAt"`
	DecidedByName         *string               `json:"decidedByName"`
}

type BrandDetail struct {
	BrandSummary
	Description            string            `json:"description"`
	Members                []BrandMember     `json:"members"`
	LinkedStores           []LinkedStore     `json:"linkedStores"`
	OfficialRequest        *OfficialRequest  `json:"officialRequest"`
	AllowedOfficialActions []string          `json:"allowedOfficialActions"`
	ClaimsFiled            []any             `json:"claimsFiled"`
	History                []json.RawMessage `json:"history"`
}

func LatestRequest(ctx context.Context, client *ent.Client, brandId uuid.UUID) (*ent.BrandOfficialRequest, error) {
	row, err := client.BrandOfficialRequest.Query().Where(brandofficialrequest.BrandID(brandId)).Order(ent.Desc(brandofficialrequest.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func userSummaries(ctx context.Context, deployed *container.Container, accountIds []uuid.UUID) map[uuid.UUID]map[string]any {
	found := map[uuid.UUID]map[string]any{}
	if deployed.Identity != nil && len(accountIds) > 0 {
		if summaries, err := deployed.Identity.UserSummaries(ctx, accountIds); err == nil {
			found = summaries
		}
	}
	for _, accountId := range accountIds {
		if _, known := found[accountId]; !known {
			found[accountId] = map[string]any{"id": accountId.String(), "username": "", "displayName": "", "avatarUrl": nil, "status": "ACTIVE", "verification": nil}
		}
	}
	return found
}

func Summaries(ctx context.Context, deployed *container.Container, rows []*ent.Brand) ([]BrandSummary, error) {
	owners := []uuid.UUID{}
	brandIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		brandIds = append(brandIds, row.ID)
		if row.OwnerAccountID != nil {
			owners = append(owners, *row.OwnerAccountID)
		}
	}
	linked, err := deployed.Client.Store.Query().Where(store.BrandIDIn(brandIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	linkedCount := map[uuid.UUID]int{}
	for _, row := range linked {
		linkedCount[*row.BrandID]++
	}
	requests, err := deployed.Client.BrandOfficialRequest.Query().Where(brandofficialrequest.BrandIDIn(brandIds...)).Order(ent.Asc(brandofficialrequest.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	latest := map[uuid.UUID]*ent.BrandOfficialRequest{}
	for _, request := range requests {
		latest[request.BrandID] = request
	}
	people := userSummaries(ctx, deployed, owners)
	summaries := make([]BrandSummary, 0, len(rows))
	for _, row := range rows {
		summary := BrandSummary{Id: row.ID.String(), Name: row.Name, Slug: row.Slug, LogoUrl: row.LogoURL, Category: row.CategoryName, Country: row.CountryCode, Website: row.Website,
			Status: "ACTIVE", OfficialStatus: row.OfficialStatus, LinkedStoreCount: linkedCount[row.ID], CreatedAt: row.CreatedAt}
		if !row.Active {
			summary.Status = "SUSPENDED"
		}
		if row.OwnerAccountID != nil {
			summary.Owner, summary.MemberCount = people[*row.OwnerAccountID], 1
		}
		if request := latest[row.ID]; request != nil {
			summary.OfficialRequestSubmittedAt = &request.CreatedAt
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

func Detail(ctx context.Context, deployed *container.Container, row *ent.Brand) (BrandDetail, error) {
	summaries, err := Summaries(ctx, deployed, []*ent.Brand{row})
	if err != nil {
		return BrandDetail{}, err
	}
	detail := BrandDetail{BrandSummary: summaries[0], Description: row.Description, Members: []BrandMember{}, LinkedStores: []LinkedStore{}, ClaimsFiled: []any{},
		AllowedOfficialActions: AllowedOfficialActions(row.OfficialStatus), History: catalogservices.StaffHistory(ctx, deployed, SubjectType, row.ID.String())}
	if detail.Owner != nil {
		detail.Members = append(detail.Members, BrandMember{User: detail.Owner, Role: "OWNER", AddedAt: row.CreatedAt})
	}
	stores, err := deployed.Client.Store.Query().Where(store.BrandID(row.ID)).Order(ent.Asc(store.FieldName)).All(ctx)
	if err != nil {
		return detail, err
	}
	sellers := make([]uuid.UUID, 0, len(stores))
	for _, linked := range stores {
		sellers = append(sellers, linked.OwnerAccountID)
	}
	people := userSummaries(ctx, deployed, sellers)
	hasVerifiedStore := false
	for _, linked := range stores {
		hasVerifiedStore = hasVerifiedStore || linked.Verified
		detail.LinkedStores = append(detail.LinkedStores, LinkedStore{Id: linked.ID.String(), StoreName: linked.Name, Seller: people[linked.OwnerAccountID],
			LinkedAt: linked.UpdatedAt, IsVerified: linked.Verified, HasOfficialBadge: linked.HasOfficialBadge})
	}
	request, err := LatestRequest(ctx, deployed.Client, row.ID)
	if err != nil || request == nil {
		return detail, err
	}
	detail.OfficialRequest = presentRequest(ctx, deployed, row, request, hasVerifiedStore)
	return detail, nil
}

func presentRequest(ctx context.Context, deployed *container.Container, row *ent.Brand, request *ent.BrandOfficialRequest, hasVerifiedStore bool) *OfficialRequest {
	view := &OfficialRequest{Id: request.ID.String(), SubmittedAt: request.CreatedAt, Trademark: request.Trademark, CacRegistrationNumber: request.CacRegistrationNumber,
		CacCompanyName: request.CacCompanyName, ContactEmail: request.ContactEmail, Documents: []RequestDocument{}, LastDecisionReason: request.LastDecisionReason,
		DecidedAt: request.DecidedAt, DecidedByName: request.DecidedByName,
		Checks: ComputeChecks(request.Trademark, request.CacCompanyName, request.ContactEmail, row.Website, hasVerifiedStore, deployed.Now())}
	if request.SubmittedByAccountID != nil {
		view.SubmittedBy = userSummaries(ctx, deployed, []uuid.UUID{*request.SubmittedByAccountID})[*request.SubmittedByAccountID]
	}
	for _, document := range request.Documents {
		view.Documents = append(view.Documents, RequestDocument{Id: document.Id, Kind: document.Kind, Label: document.Label, UploadedAt: document.UploadedAt})
	}
	return view
}
