package services

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/creators/src/container"
	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/creatorbranddeal"
	"nantty/modules/creators/src/modules/brandDeals/dtos"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
)

var (
	ErrBrandDealsCreatorOnly = httpserver.NewApiError(http.StatusForbidden, "CREATOR_PROGRAM_REQUIRED", "Brand deals are available to approved creators.")
	ErrBrandDealNotFound     = httpserver.NewApiError(http.StatusNotFound, "BRAND_DEAL_NOT_FOUND", "Brand deal not found.")
)

type BrandDeals struct {
	Container *container.Container
	Program   programservices.CreatorProgram
}

type NewBrandDeal struct {
	CreatorId      string
	IdempotencyKey string
	BrandName      string
	AmountMinor    int64
	Currency       string
	StartsAt       time.Time
	EndsAt         *time.Time
	Disclosure     string
	Notes          string
}

type RecordedBrandDeal struct {
	Deal     dtos.BrandDealDto
	Replayed bool
}

func (deals BrandDeals) client() *ent.Client {
	return deals.Container.Client(deals.Container.Resources.Database)
}

func (deals BrandDeals) RecordBrandDeal(ctx context.Context, input NewBrandDeal) (RecordedBrandDeal, error) {
	if _, approved, err := deals.Program.ApprovedCreatorShare(ctx, deals.Container.Resources.Database, input.CreatorId); err != nil {
		return RecordedBrandDeal{}, err
	} else if !approved {
		return RecordedBrandDeal{}, ErrBrandDealsCreatorOnly
	}
	existing, err := deals.client().CreatorBrandDeal.Query().
		Where(creatorbranddeal.CreatorUserID(input.CreatorId), creatorbranddeal.IdempotencyKey(input.IdempotencyKey)).Only(ctx)
	if err == nil {
		if !sameBrandDeal(existing, input) {
			return RecordedBrandDeal{}, ledgerutils.ErrIdempotencyKeyReused
		}
		return RecordedBrandDeal{Deal: PresentBrandDeal(existing), Replayed: true}, nil
	}
	if !ent.IsNotFound(err) {
		return RecordedBrandDeal{}, err
	}
	created, err := deals.client().CreatorBrandDeal.Create().
		SetCreatorUserID(input.CreatorId).SetIdempotencyKey(input.IdempotencyKey).SetBrandName(input.BrandName).
		SetAmountMinor(input.AmountMinor).SetCurrency(input.Currency).SetStartsAt(input.StartsAt.UTC()).
		SetNillableEndsAt(utcOrNil(input.EndsAt)).SetDisclosure(input.Disclosure).SetNotes(input.Notes).
		SetCreatedAt(deals.Container.Now().UTC()).Save(ctx)
	if ent.IsConstraintError(err) {
		return deals.RecordBrandDeal(ctx, input)
	}
	if err != nil {
		return RecordedBrandDeal{}, err
	}
	return RecordedBrandDeal{Deal: PresentBrandDeal(created)}, nil
}

func (deals BrandDeals) ListBrandDeals(ctx context.Context, creatorId, cursor string, limit int) ([]dtos.BrandDealDto, string, error) {
	query := deals.client().CreatorBrandDeal.Query().Where(creatorbranddeal.CreatorUserID(creatorId))
	if cursor != "" {
		after, err := uuid.Parse(cursor)
		if err != nil {
			return nil, "", httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The cursor is not valid.")
		}
		query = query.Where(creatorbranddeal.IDLT(after))
	}
	rows, err := query.Order(ent.Desc(creatorbranddeal.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > limit {
		rows = rows[:limit]
		next = rows[limit-1].ID.String()
	}
	views := make([]dtos.BrandDealDto, 0, len(rows))
	for _, row := range rows {
		views = append(views, PresentBrandDeal(row))
	}
	return views, next, nil
}

func (deals BrandDeals) RemoveBrandDeal(ctx context.Context, creatorId, dealId string) error {
	identifier, err := uuid.Parse(dealId)
	if err != nil {
		return ErrBrandDealNotFound
	}
	removed, err := deals.client().CreatorBrandDeal.Delete().
		Where(creatorbranddeal.ID(identifier), creatorbranddeal.CreatorUserID(creatorId)).Exec(ctx)
	if err != nil {
		return err
	}
	if removed == 0 {
		return ErrBrandDealNotFound
	}
	return nil
}

func PresentBrandDeal(row *ent.CreatorBrandDeal) dtos.BrandDealDto {
	view := dtos.BrandDealDto{
		Id: row.ID.String(), BrandName: row.BrandName, Amount: dtos.MoneyDto{AmountMinor: row.AmountMinor, Currency: row.Currency},
		StartsAt: row.StartsAt.UTC().Format(time.RFC3339), Disclosure: row.Disclosure, Notes: row.Notes, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
	}
	if row.EndsAt != nil {
		formatted := row.EndsAt.UTC().Format(time.RFC3339)
		view.EndsAt = &formatted
	}
	return view
}

func sameBrandDeal(row *ent.CreatorBrandDeal, input NewBrandDeal) bool {
	sameEnd := (row.EndsAt == nil && input.EndsAt == nil) || (row.EndsAt != nil && input.EndsAt != nil && row.EndsAt.Equal(*input.EndsAt))
	return sameEnd && row.BrandName == input.BrandName && row.AmountMinor == input.AmountMinor && strings.EqualFold(row.Currency, input.Currency) &&
		row.StartsAt.Equal(input.StartsAt) && row.Disclosure == input.Disclosure && row.Notes == input.Notes
}

func utcOrNil(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	utc := value.UTC()
	return &utc
}
