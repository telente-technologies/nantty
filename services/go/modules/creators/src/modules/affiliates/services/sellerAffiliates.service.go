package services

import (
	"context"
	"database/sql"
	"sort"
	"time"

	"github.com/google/uuid"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
	"nantty/modules/creators/src/generated/ent/creatoraffiliation"
	"nantty/modules/creators/src/repositories"
)

type AffiliateCreatorView struct {
	Id        string  `json:"id"`
	Username  string  `json:"username"`
	Name      string  `json:"name"`
	Followers int64   `json:"followers"`
	Niche     string  `json:"niche"`
	AvatarUrl *string `json:"avatarUrl"`
}

type AffiliateRequestView struct {
	Id             string               `json:"id"`
	Creator        AffiliateCreatorView `json:"creator"`
	ProductId      *string              `json:"productId"`
	Message        string               `json:"message"`
	RequestedAt    time.Time            `json:"requestedAt"`
	Status         string               `json:"status"`
	DecisionReason *string              `json:"decisionReason"`
}

type CreatorPerformanceView struct {
	Creator        AffiliateCreatorView `json:"creator"`
	Clicks         int64                `json:"clicks"`
	Orders         int                  `json:"orders"`
	Sales          Money                `json:"sales"`
	CommissionOwed Money                `json:"commissionOwed"`
	CommissionPaid Money                `json:"commissionPaid"`
	LastSaleAt     *time.Time           `json:"lastSaleAt"`
	Status         string               `json:"status"`
}

func (affiliates Affiliates) creatorViews(ctx context.Context, ids []string) (map[string]AffiliateCreatorView, error) {
	users, err := affiliates.Container.Directory.FindUserSummaries(ctx, ids)
	views := map[string]AffiliateCreatorView{}
	for _, id := range ids {
		user := users[id]
		followers, followerErr := affiliates.Container.Directory.FollowerCount(ctx, id)
		if followerErr != nil {
			return nil, followerErr
		}
		views[id] = AffiliateCreatorView{Id: id, Username: user.Username, Name: user.Name, AvatarUrl: user.AvatarUrl, Followers: followers}
	}
	return views, err
}

func requestStatus(status creatoraffiliation.Status) string {
	switch status {
	case creatoraffiliation.StatusRequested:
		return "pending"
	case creatoraffiliation.StatusDeclined:
		return "declined"
	}
	return "approved"
}

func (affiliates Affiliates) presentRequests(ctx context.Context, rows []*ent.CreatorAffiliation) ([]AffiliateRequestView, error) {
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.CreatorID)
	}
	creators, err := affiliates.creatorViews(ctx, ids)
	if err != nil {
		return nil, err
	}
	views := make([]AffiliateRequestView, 0, len(rows))
	for _, row := range rows {
		view := AffiliateRequestView{Id: row.ID.String(), Creator: creators[row.CreatorID], Message: row.Message, RequestedAt: row.CreatedAt, Status: requestStatus(row.Status)}
		if row.ProductID != "" {
			view.ProductId = &row.ProductID
		}
		if row.DecisionReason != "" {
			view.DecisionReason = &row.DecisionReason
		}
		views = append(views, view)
	}
	return views, nil
}

func (affiliates Affiliates) ListRequests(ctx context.Context, store repositories.StoreSummary, status string, limit int) ([]AffiliateRequestView, error) {
	query := affiliates.Container.Client(affiliates.Container.Resources.Database).CreatorAffiliation.Query().Where(creatoraffiliation.StoreID(store.Id))
	switch status {
	case "pending":
		query.Where(creatoraffiliation.StatusEQ(creatoraffiliation.StatusRequested))
	case "approved":
		query.Where(creatoraffiliation.StatusIn(creatoraffiliation.StatusActive, creatoraffiliation.StatusPaused))
	case "declined":
		query.Where(creatoraffiliation.StatusEQ(creatoraffiliation.StatusDeclined))
	}
	rows, err := query.Order(ent.Desc(creatoraffiliation.FieldCreatedAt)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	return affiliates.presentRequests(ctx, rows)
}

func (affiliates Affiliates) DecideRequest(ctx context.Context, store repositories.StoreSummary, requestId string, approve bool, reason string) (AffiliateRequestView, error) {
	id, err := uuid.Parse(requestId)
	if err != nil {
		return AffiliateRequestView{}, ErrRequestNotFound
	}
	var decided *ent.CreatorAffiliation
	err = affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		row, err := client.CreatorAffiliation.Query().Where(creatoraffiliation.ID(id), creatoraffiliation.StoreID(store.Id)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return ErrRequestNotFound
		}
		if err != nil {
			return err
		}
		if row.Status != creatoraffiliation.StatusRequested {
			return ErrRequestDecided
		}
		status := map[bool]creatoraffiliation.Status{true: creatoraffiliation.StatusActive, false: creatoraffiliation.StatusDeclined}[approve]
		if decided, err = row.Update().SetStatus(status).SetDecisionReason(reason).SetDecidedAt(affiliates.Container.Now().UTC()).Save(ctx); err != nil {
			return err
		}
		return affiliates.audit(ctx, transaction, "affiliation."+map[bool]string{true: "approved", false: "declined"}[approve], store, map[string]any{
			"affiliationId": row.ID.String(), "creatorId": row.CreatorID, "reason": reason,
		})
	})
	if err != nil {
		return AffiliateRequestView{}, err
	}
	views, err := affiliates.presentRequests(ctx, []*ent.CreatorAffiliation{decided})
	return views[0], err
}

func (affiliates Affiliates) ListCreators(ctx context.Context, store repositories.StoreSummary, from, to *time.Time) ([]CreatorPerformanceView, error) {
	client := affiliates.Container.Client(affiliates.Container.Resources.Database)
	members, err := client.CreatorAffiliation.Query().Where(creatoraffiliation.StoreID(store.Id), creatoraffiliation.StatusIn(creatoraffiliation.StatusActive, creatoraffiliation.StatusPaused)).All(ctx)
	if err != nil {
		return nil, err
	}
	status, ids := map[string]string{}, []string{}
	for _, member := range members {
		if _, seen := status[member.CreatorID]; !seen {
			ids = append(ids, member.CreatorID)
		}
		if status[member.CreatorID] != "active" {
			status[member.CreatorID] = member.Status.String()
		}
	}
	query := client.AffiliateCommission.Query().Where(affiliatecommission.StoreID(store.Id), affiliatecommission.CreatorIDIn(ids...))
	if from != nil {
		query.Where(affiliatecommission.CreatedAtGTE(*from))
	}
	if to != nil {
		query.Where(affiliatecommission.CreatedAtLT(*to))
	}
	commissions, err := query.All(ctx)
	if err != nil {
		return nil, err
	}
	creators, err := affiliates.creatorViews(ctx, ids)
	if err != nil {
		return nil, err
	}
	performance := map[string]*CreatorPerformanceView{}
	for _, id := range ids {
		zero := Money{0, store.Currency}
		performance[id] = &CreatorPerformanceView{Creator: creators[id], Sales: zero, CommissionOwed: zero, CommissionPaid: zero, Status: status[id]}
	}
	for _, commission := range commissions {
		view := performance[commission.CreatorID]
		if view == nil || commission.Status == affiliatecommission.StatusReversed {
			continue
		}
		view.Orders++
		view.Sales.AmountMinor += commission.SaleMinor
		net := commission.CommissionMinor - commission.ReversedMinor
		if commission.Status == affiliatecommission.StatusPaid {
			view.CommissionPaid.AmountMinor += net
		} else {
			view.CommissionOwed.AmountMinor += net
		}
		if view.LastSaleAt == nil || commission.CreatedAt.After(*view.LastSaleAt) {
			at := commission.CreatedAt
			view.LastSaleAt = &at
		}
	}
	views := make([]CreatorPerformanceView, 0, len(performance))
	for _, id := range ids {
		views = append(views, *performance[id])
	}
	sort.SliceStable(views, func(left, right int) bool { return views[left].Sales.AmountMinor > views[right].Sales.AmountMinor })
	return views, nil
}

func (affiliates Affiliates) SetCreatorStatus(ctx context.Context, store repositories.StoreSummary, creatorId, status string) error {
	target := map[string]creatoraffiliation.Status{"active": creatoraffiliation.StatusActive, "paused": creatoraffiliation.StatusPaused, "removed": creatoraffiliation.StatusRemoved}[status]
	return affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		count, err := client.CreatorAffiliation.Update().Where(creatoraffiliation.StoreID(store.Id), creatoraffiliation.CreatorID(creatorId),
			creatoraffiliation.StatusIn(creatoraffiliation.StatusActive, creatoraffiliation.StatusPaused)).SetStatus(target).Save(ctx)
		if err != nil {
			return err
		}
		if count == 0 {
			return ErrAffiliateNotFound
		}
		return affiliates.audit(ctx, transaction, "affiliation.statusChanged", store, map[string]any{"creatorId": creatorId, "status": status})
	})
}
