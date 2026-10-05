package listmystores

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/store"
	"zudomart/modules/catalog/src/generated/ent/storemember"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/sellerplans"
)

type Query struct {
	AccountId      uuid.UUID
	RequestedStore *uuid.UUID
}

type Verification struct {
	Status       string  `json:"status"`
	Tier         *string `json:"tier"`
	BadgeVisible bool    `json:"badgeVisible"`
}

type Subscription struct {
	Status string `json:"status"`
	Plan   string `json:"plan"`
}

type MyStoreEntry struct {
	StoreId      string        `json:"storeId"`
	StoreName    string        `json:"storeName"`
	BrandId      *string       `json:"brandId"`
	Role         string        `json:"role"`
	Verification Verification  `json:"verification"`
	Subscription *Subscription `json:"subscription"`
	IsCurrent    bool          `json:"isCurrent"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[MyStoreEntry], error) {
	members, err := handler.Container.Client.StoreMember.Query().Where(storemember.AccountID(query.AccountId), storemember.Status("active")).
		Order(ent.Asc(storemember.FieldCreatedAt)).All(ctx)
	if err != nil || len(members) == 0 {
		return httpserver.NewCursorPage([]MyStoreEntry{}, ""), err
	}
	storeIds := make([]uuid.UUID, 0, len(members))
	for _, member := range members {
		storeIds = append(storeIds, member.StoreID)
	}
	rows, err := handler.Container.Client.Store.Query().Where(store.IDIn(storeIds...), store.StatusNEQ("closed")).All(ctx)
	if err != nil {
		return httpserver.CursorPage[MyStoreEntry]{}, err
	}
	stores := map[uuid.UUID]*ent.Store{}
	for _, row := range rows {
		stores[row.ID] = row
	}
	current := query.RequestedStore
	if current == nil {
		if access, found, accessError := services.FindStoreAccess(ctx, handler.Container, query.AccountId, nil); accessError == nil && found {
			current = &access.StoreId
		}
	}
	entries := make([]MyStoreEntry, 0, len(members))
	for _, member := range members {
		row, known := stores[member.StoreID]
		if !known {
			continue
		}
		entries = append(entries, handler.entryOf(ctx, row, member.Role, current != nil && *current == row.ID))
	}
	return httpserver.NewCursorPage(entries, ""), nil
}

func (handler Handler) entryOf(ctx context.Context, row *ent.Store, role string, isCurrent bool) MyStoreEntry {
	entry := MyStoreEntry{StoreId: row.ID.String(), StoreName: row.Name, Role: role, IsCurrent: isCurrent, Verification: Verification{Status: "unverified", BadgeVisible: row.Verified}}
	if row.Verified {
		entry.Verification.Status = "verified"
	}
	if row.BrandID != nil {
		brandId := row.BrandID.String()
		entry.BrandId = &brandId
	}
	if plan := sellerplans.Default.PlanOf(ctx, row.OwnerAccountID); !sellerplans.Default.AllowAll && plan != sellerplans.Free && plan != "" {
		entry.Subscription = &Subscription{Status: "active", Plan: strings.ToUpper(string(plan))}
	}
	return entry
}
