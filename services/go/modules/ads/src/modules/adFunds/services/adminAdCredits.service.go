package services

import (
	"context"
	"strings"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adcreditlot"
	"zudomart/modules/ads/src/modules/adFunds/dtos"
	boostservices "zudomart/modules/ads/src/modules/boosts/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

type StaffActor struct {
	Id   string
	Name string
}

type CreditListFilter struct {
	UserId *uuid.UUID
	Status string
	Source string
	Cursor *uuid.UUID
	Limit  int
}

func usernamesFor(ctx context.Context, deployed *container.Container, ids []string) map[string]string {
	names := map[string]string{}
	if deployed.Users == nil || len(ids) == 0 {
		return names
	}
	found, err := deployed.Users.LookupUsers(ctx, ids)
	if err != nil {
		return names
	}
	for id, user := range found {
		names[id] = user.Username
	}
	return names
}

func PresentAdminCredits(ctx context.Context, deployed *container.Container, lots []*ent.AdCreditLot) []dtos.AdminAdCredit {
	ids := make([]string, 0, len(lots))
	for _, lot := range lots {
		ids = append(ids, lot.UserID.String())
	}
	names := usernamesFor(ctx, deployed, ids)
	presented := make([]dtos.AdminAdCredit, 0, len(lots))
	for _, lot := range lots {
		money := func(value int64) types.Money { return types.Money{AmountMinor: value, Currency: lot.Currency} }
		row := dtos.AdminAdCredit{Id: lot.ID.String(), UserId: lot.UserID.String(), Username: names[lot.UserID.String()], AccountId: lot.AccountID.String(), Source: string(lot.Source),
			Amount: money(lot.OriginalMinor), Remaining: money(lot.RemainingMinor), Reason: lot.Reason, Status: string(lot.Status), CreatedAt: lot.CreatedAt.UTC().Format(time.RFC3339)}
		if lot.ExpiresAt != nil {
			formatted := lot.ExpiresAt.UTC().Format(time.RFC3339)
			row.ExpiresAt = &formatted
		}
		if lot.IssuedByStaffID != "" {
			row.IssuedBy = &dtos.StaffReference{Id: lot.IssuedByStaffID, Name: lot.IssuedByName}
		}
		if lot.RevokedAt != nil {
			formatted := lot.RevokedAt.UTC().Format(time.RFC3339)
			revoked := money(lot.RevokedMinor)
			row.RevokedAt, row.RevokedAmount = &formatted, &revoked
		}
		presented = append(presented, row)
	}
	return presented
}

func ListAdminCredits(ctx context.Context, deployed *container.Container, filter CreditListFilter) ([]dtos.AdminAdCredit, string, error) {
	query := deployed.Client.AdCreditLot.Query()
	if filter.UserId != nil {
		query.Where(adcreditlot.UserID(*filter.UserId))
	}
	if filter.Status != "" {
		query.Where(adcreditlot.StatusEQ(adcreditlot.Status(filter.Status)))
	}
	if filter.Source != "" {
		query.Where(adcreditlot.SourceEQ(adcreditlot.Source(filter.Source)))
	}
	if filter.Cursor != nil {
		query.Where(adcreditlot.IDLT(*filter.Cursor))
	}
	lots, err := query.Order(adcreditlot.ByID(sql.OrderDesc())).Limit(filter.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(lots) > filter.Limit {
		lots = lots[:filter.Limit]
		next = utils.EncodeCursor(lots[len(lots)-1].ID)
	}
	return PresentAdminCredits(ctx, deployed, lots), next, nil
}

func ValidateIssueRequest(request dtos.IssueAdCreditRequest, now time.Time) (uuid.UUID, *time.Time, error) {
	var issues []httpserver.ValidationIssue
	userId, err := uuid.Parse(request.UserId)
	if err != nil {
		issues = append(issues, httpserver.ValidationIssue{Path: "userId", Message: "Pick a user."})
	}
	if request.Amount.AmountMinor <= 0 || request.Amount.AmountMinor > 1_000_000_000_000 || !regionpricing.IsSupportedCurrency(request.Amount.Currency) {
		issues = append(issues, httpserver.ValidationIssue{Path: "amount", Message: "Enter a positive amount in a supported currency."})
	}
	if reason := strings.TrimSpace(request.Reason); len(reason) < 5 || len(reason) > 500 {
		issues = append(issues, httpserver.ValidationIssue{Path: "reason", Message: "Give a reason of 5-500 characters."})
	}
	var expiresAt *time.Time
	if request.ExpiresAt != nil && *request.ExpiresAt != "" {
		parsed, err := time.Parse(time.RFC3339, *request.ExpiresAt)
		if err != nil || !parsed.After(now) {
			issues = append(issues, httpserver.ValidationIssue{Path: "expiresAt", Message: "Choose a future expiry date, or none."})
		} else {
			parsed = parsed.UTC()
			expiresAt = &parsed
		}
	}
	if len(issues) > 0 {
		return uuid.Nil, nil, httpserver.NewValidationFailedError(issues)
	}
	return userId, expiresAt, nil
}

func IssueAdminCredit(ctx context.Context, deployed *container.Container, staff StaffActor, idempotencyKey string, request dtos.IssueAdCreditRequest) (dtos.AdminAdCredit, bool, error) {
	now := deployed.Now()
	userId, expiresAt, err := ValidateIssueRequest(request, now)
	if err != nil {
		return dtos.AdminAdCredit{}, false, err
	}
	account, err := boostservices.EnsurePersonalBoostAccount(ctx, deployed.Client, userId, request.Amount.Currency, "")
	if err != nil {
		return dtos.AdminAdCredit{}, false, err
	}
	var lot *ent.AdCreditLot
	created := false
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		lot, created, err = adsservices.IssueCreditLotInTransaction(ctx, tx, adsservices.CreditLotInput{
			AccountId: account.ID, UserId: userId, Currency: request.Amount.Currency, Source: adcreditlot.SourceAdminIssued, AmountMinor: request.Amount.AmountMinor,
			ExpiresAt: expiresAt, Reason: strings.TrimSpace(request.Reason), Reference: "admin:" + staff.Id + ":" + idempotencyKey, StaffId: staff.Id, StaffName: staff.Name,
		}, now)
		return err
	})
	if err != nil {
		return dtos.AdminAdCredit{}, false, err
	}
	sameExpiry := (lot.ExpiresAt == nil) == (expiresAt == nil) && (expiresAt == nil || lot.ExpiresAt.Equal(*expiresAt))
	if !created && (lot.UserID != userId || lot.OriginalMinor != request.Amount.AmountMinor || lot.Currency != request.Amount.Currency || !sameExpiry || lot.Reason != strings.TrimSpace(request.Reason)) {
		return dtos.AdminAdCredit{}, false, adserrors.IdempotencyKeyReused
	}
	return PresentAdminCredits(ctx, deployed, []*ent.AdCreditLot{lot})[0], created, nil
}

func RevokeAdminCredit(ctx context.Context, deployed *container.Container, staff StaffActor, lotId uuid.UUID, reason string) (dtos.AdminAdCredit, dtos.AdminAdCredit, error) {
	reason = strings.TrimSpace(reason)
	if len(reason) < 5 || len(reason) > 500 {
		return dtos.AdminAdCredit{}, dtos.AdminAdCredit{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "Give a reason of 5-500 characters."}})
	}
	before, err := deployed.Client.AdCreditLot.Get(ctx, lotId)
	if ent.IsNotFound(err) {
		return dtos.AdminAdCredit{}, dtos.AdminAdCredit{}, adserrors.NotFound
	}
	if err != nil {
		return dtos.AdminAdCredit{}, dtos.AdminAdCredit{}, err
	}
	var after *ent.AdCreditLot
	var removed int64
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		after, removed, err = adsservices.RemoveCreditLotRemainderInTransaction(ctx, tx, lotId, adsservices.CreditChangeRevoked, staff.Id, reason, deployed.Now())
		return err
	})
	if err != nil {
		return dtos.AdminAdCredit{}, dtos.AdminAdCredit{}, err
	}
	if removed == 0 {
		return dtos.AdminAdCredit{}, dtos.AdminAdCredit{}, adserrors.CreditNotRevocable
	}
	presented := PresentAdminCredits(ctx, deployed, []*ent.AdCreditLot{before, after})
	return presented[0], presented[1], nil
}
