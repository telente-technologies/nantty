package services

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/google/uuid"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/coinpurchase"
	"zudomart/modules/wallet/src/generated/ent/cointransfer"
	"zudomart/modules/wallet/src/generated/ent/walletriskflag"
	"zudomart/modules/wallet/src/modules/coins/dtos"
	"zudomart/platform/httpserver"
)

var (
	ErrCoinTransactionNotFound   = httpserver.NewApiError(http.StatusNotFound, "COIN_TRANSACTION_NOT_FOUND", "Coin transaction was not found.")
	ErrCoinTransactionNotPending = httpserver.NewApiError(http.StatusConflict, "COIN_TRANSACTION_NOT_PENDING", "Only transactions waiting for review can be marked reviewed.")
)

type CoinReviews struct {
	Container *container.Container
}

type CoinTransactionFilter struct {
	Kind         string
	ReviewStatus string
	Search       string
	AfterId      *uuid.UUID
	Limit        int
}

type CoinTransactionRecord struct {
	Purchase *ent.CoinPurchase
	Transfer *ent.CoinTransfer
}

func (record CoinTransactionRecord) Id() uuid.UUID {
	if record.Purchase != nil {
		return record.Purchase.ID
	}
	return record.Transfer.ID
}

func (reviews CoinReviews) ListForStaff(ctx context.Context, filter CoinTransactionFilter) (dtos.CoinTransactionListDto, error) {
	client := reviews.Container.Client(reviews.Container.Resources.Database)
	records := []CoinTransactionRecord{}
	search := strings.TrimSpace(filter.Search)
	if filter.Kind == "" || filter.Kind == "purchase" {
		query := client.CoinPurchase.Query().Where(coinpurchase.StatusIn(coinpurchase.StatusSucceeded, coinpurchase.StatusRefunded))
		if filter.ReviewStatus != "" {
			query.Where(coinpurchase.ReviewStatusEQ(coinpurchase.ReviewStatus(filter.ReviewStatus)))
		}
		if ledgerutils.IsUuid(search) {
			query.Where(coinpurchase.Or(coinpurchase.UserID(strings.ToLower(search)), coinpurchase.ID(uuid.MustParse(search))))
		} else if search != "" {
			query.Where(coinpurchase.Reference(search))
		}
		if filter.AfterId != nil {
			query.Where(coinpurchase.IDLT(*filter.AfterId))
		}
		rows, err := query.Order(ent.Desc(coinpurchase.FieldID)).Limit(filter.Limit + 1).All(ctx)
		if err != nil {
			return dtos.CoinTransactionListDto{}, err
		}
		for _, row := range rows {
			records = append(records, CoinTransactionRecord{Purchase: row})
		}
	}
	if (filter.Kind == "" || filter.Kind == "transfer") && (search == "" || ledgerutils.IsUuid(search)) {
		query := client.CoinTransfer.Query()
		if filter.ReviewStatus != "" {
			query.Where(cointransfer.ReviewStatusEQ(cointransfer.ReviewStatus(filter.ReviewStatus)))
		}
		if search != "" {
			identifier := strings.ToLower(search)
			query.Where(cointransfer.Or(cointransfer.SenderUserID(identifier), cointransfer.RecipientUserID(identifier), cointransfer.ID(uuid.MustParse(identifier))))
		}
		if filter.AfterId != nil {
			query.Where(cointransfer.IDLT(*filter.AfterId))
		}
		rows, err := query.Order(ent.Desc(cointransfer.FieldID)).Limit(filter.Limit + 1).All(ctx)
		if err != nil {
			return dtos.CoinTransactionListDto{}, err
		}
		for _, row := range rows {
			records = append(records, CoinTransactionRecord{Transfer: row})
		}
	}
	slices.SortFunc(records, func(left, right CoinTransactionRecord) int {
		return strings.Compare(right.Id().String(), left.Id().String())
	})
	var nextCursor *string
	if len(records) > filter.Limit {
		records = records[:filter.Limit]
		cursor := records[len(records)-1].Id().String()
		nextCursor = &cursor
	}
	views, err := reviews.Convert(ctx, records)
	if err != nil {
		return dtos.CoinTransactionListDto{}, err
	}
	counts, err := reviews.countByReviewStatus(ctx, client)
	return dtos.CoinTransactionListDto{Data: views, NextCursor: nextCursor, Counts: counts}, err
}

func (reviews CoinReviews) FindRecord(ctx context.Context, client *ent.Client, transactionId uuid.UUID, forUpdate bool) (CoinTransactionRecord, error) {
	purchaseQuery := client.CoinPurchase.Query().Where(coinpurchase.ID(transactionId))
	transferQuery := client.CoinTransfer.Query().Where(cointransfer.ID(transactionId))
	if forUpdate {
		purchaseQuery.ForUpdate()
		transferQuery.ForUpdate()
	}
	purchase, err := purchaseQuery.Only(ctx)
	if err == nil {
		return CoinTransactionRecord{Purchase: purchase}, nil
	}
	if !ent.IsNotFound(err) {
		return CoinTransactionRecord{}, err
	}
	transfer, err := transferQuery.Only(ctx)
	if ent.IsNotFound(err) {
		return CoinTransactionRecord{}, ErrCoinTransactionNotFound
	}
	return CoinTransactionRecord{Transfer: transfer}, err
}

func (reviews CoinReviews) GetForStaff(ctx context.Context, transactionId uuid.UUID) (dtos.CoinTransactionDetailDto, error) {
	record, err := reviews.FindRecord(ctx, reviews.Container.Client(reviews.Container.Resources.Database), transactionId, false)
	if err != nil {
		return dtos.CoinTransactionDetailDto{}, err
	}
	views, err := reviews.Convert(ctx, []CoinTransactionRecord{record})
	if err != nil {
		return dtos.CoinTransactionDetailDto{}, err
	}
	view := views[0]
	history := []dtos.CoinTransactionHistoryDto{{Action: "created", OccurredAt: view.CreatedAt}}
	if view.ReviewedAt != nil {
		history = append(history, dtos.CoinTransactionHistoryDto{Action: view.ReviewStatus, OccurredAt: *view.ReviewedAt, StaffId: view.ReviewedByStaffId, Note: view.ReviewNote})
	}
	return dtos.CoinTransactionDetailDto{CoinTransactionDto: view, History: history}, nil
}

func (reviews CoinReviews) MarkReviewed(ctx context.Context, staffId string, transactionId uuid.UUID, note string) error {
	client := reviews.Container.Client(reviews.Container.Resources.Database)
	now := reviews.Container.Now().UTC()
	updated, err := client.CoinPurchase.Update().Where(coinpurchase.ID(transactionId), coinpurchase.ReviewStatusEQ(coinpurchase.ReviewStatusPendingReview)).
		SetReviewStatus(coinpurchase.ReviewStatusReviewed).SetReviewedByStaffID(staffId).SetReviewedAt(now).SetReviewNote(note).Save(ctx)
	if err != nil || updated == 1 {
		return err
	}
	updated, err = client.CoinTransfer.Update().Where(cointransfer.ID(transactionId), cointransfer.ReviewStatusEQ(cointransfer.ReviewStatusPendingReview)).
		SetReviewStatus(cointransfer.ReviewStatusReviewed).SetReviewedByStaffID(staffId).SetReviewedAt(now).SetReviewNote(note).Save(ctx)
	if err != nil || updated == 1 {
		return err
	}
	if _, err := reviews.FindRecord(ctx, client, transactionId, false); err != nil {
		return err
	}
	return ErrCoinTransactionNotPending
}

func (reviews CoinReviews) Convert(ctx context.Context, records []CoinTransactionRecord) ([]dtos.CoinTransactionDto, error) {
	userIds := []string{}
	for _, record := range records {
		if record.Purchase != nil {
			userIds = append(userIds, record.Purchase.UserID)
		} else {
			userIds = append(userIds, record.Transfer.SenderUserID, record.Transfer.RecipientUserID)
		}
	}
	parties := reviews.Container.Parties.DescribeAccounts(ctx, userIds)
	flags, err := reviews.openRiskFlags(ctx, userIds)
	if err != nil {
		return nil, err
	}
	views := make([]dtos.CoinTransactionDto, len(records))
	for index, record := range records {
		views[index] = convertCoinRecord(record, parties, flags)
	}
	return views, nil
}

func (reviews CoinReviews) openRiskFlags(ctx context.Context, userIds []string) (map[string][]string, error) {
	flags := map[string][]string{}
	if len(userIds) == 0 {
		return flags, nil
	}
	rows, err := reviews.Container.Client(reviews.Container.Resources.Database).WalletRiskFlag.Query().
		Where(walletriskflag.UserIDIn(userIds...), walletriskflag.ResolvedAtIsNil()).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if !slices.Contains(flags[row.UserID], row.Reason) {
			flags[row.UserID] = append(flags[row.UserID], row.Reason)
		}
	}
	return flags, nil
}

func (reviews CoinReviews) countByReviewStatus(ctx context.Context, client *ent.Client) (map[string]int, error) {
	counts := map[string]int{"pending_review": 0, "reviewed": 0, "reversed": 0}
	var rows []struct {
		ReviewStatus string `json:"review_status"`
		Count        int    `json:"count"`
	}
	if err := client.CoinPurchase.Query().Where(coinpurchase.StatusIn(coinpurchase.StatusSucceeded, coinpurchase.StatusRefunded)).
		GroupBy(coinpurchase.FieldReviewStatus).Aggregate(ent.Count()).Scan(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.ReviewStatus] += row.Count
	}
	rows = nil
	if err := client.CoinTransfer.Query().GroupBy(cointransfer.FieldReviewStatus).Aggregate(ent.Count()).Scan(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.ReviewStatus] += row.Count
	}
	return counts, nil
}
