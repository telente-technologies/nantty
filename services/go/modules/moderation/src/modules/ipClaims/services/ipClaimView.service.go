package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/strike"
	"zudomart/modules/moderation/src/integrations"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
)

type Summary struct {
	Id               string                   `json:"id"`
	Type             string                   `json:"type"`
	Status           string                   `json:"status"`
	ClaimantBrand    json.RawMessage          `json:"claimantBrand"`
	AccusedSeller    integrations.UserSummary `json:"accusedSeller"`
	Listing          map[string]any           `json:"listing"`
	FiledAt          string                   `json:"filedAt"`
	SlaDueAt         string                   `json:"slaDueAt"`
	PriorStrikeCount int                      `json:"priorStrikeCount"`
}

type PriorStrike struct {
	Policy   string `json:"policy"`
	IssuedAt string `json:"issuedAt"`
}

type Detail struct {
	Summary
	Statement          string            `json:"statement"`
	TrademarkReference string            `json:"trademarkReference"`
	Evidence           json.RawMessage   `json:"evidence"`
	SellerResponse     json.RawMessage   `json:"sellerResponse"`
	SellerPriorStrikes []PriorStrike     `json:"sellerPriorStrikes"`
	Decision           json.RawMessage   `json:"decision"`
	AllowedActions     []string          `json:"allowedActions"`
	History            []json.RawMessage `json:"history"`
}

func BuildSummaries(ctx context.Context, c *container.Container, rows []*ent.IpClaim) ([]Summary, error) {
	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.AccusedSellerID)
	}
	users, counts := map[string]integrations.UserSummary{}, map[uuid.UUID]strikeservices.Counts{}
	if len(ids) > 0 {
		var err error
		if users, err = c.Users.Summaries(ctx, ids); err != nil {
			return nil, err
		}
		if counts, err = strikeservices.ActiveCounts(ctx, c.Client, c.Now(), ids); err != nil {
			return nil, err
		}
	}
	summaries := make([]Summary, 0, len(rows))
	for _, row := range rows {
		listing := map[string]any{}
		_ = json.Unmarshal(row.Listing, &listing)
		listing["id"], listing["status"] = row.ListingID, strings.ToUpper(string(row.ListingStatus))
		summaries = append(summaries, Summary{
			Id: row.ID.String(), Type: strings.ToUpper(string(row.Kind)), Status: strings.ToUpper(string(row.Status)), ClaimantBrand: row.ClaimantBrand, AccusedSeller: users[row.AccusedSellerID.String()], Listing: listing,
			FiledAt: row.CreatedAt.UTC().Format(time.RFC3339), SlaDueAt: row.SLADueAt.UTC().Format(time.RFC3339), PriorStrikeCount: counts[row.AccusedSellerID].ActiveStrikes,
		})
	}
	return summaries, nil
}

func BuildDetail(ctx context.Context, c *container.Container, row *ent.IpClaim) (Detail, error) {
	summaries, err := BuildSummaries(ctx, c, []*ent.IpClaim{row})
	if err != nil {
		return Detail{}, err
	}
	detail := Detail{Summary: summaries[0], Statement: row.Statement, TrademarkReference: row.TrademarkReference, Evidence: orEmptyArray(row.Evidence), SellerResponse: row.SellerResponse, Decision: row.Decision,
		AllowedActions: AllowedActions(string(row.Status)), SellerPriorStrikes: []PriorStrike{}}
	prior, err := c.Client.Strike.Query().Where(strike.AccountID(row.AccusedSellerID), strike.RevokedAtIsNil()).Order(ent.Desc(strike.FieldCreatedAt)).Limit(20).All(ctx)
	if err != nil {
		return Detail{}, err
	}
	for _, item := range prior {
		detail.SellerPriorStrikes = append(detail.SellerPriorStrikes, PriorStrike{Policy: item.Policy, IssuedAt: item.CreatedAt.UTC().Format(time.RFC3339)})
	}
	if detail.History, err = c.Audit.History(ctx, "ip_claim", row.ID.String()); err != nil {
		return Detail{}, err
	}
	return detail, nil
}

func orEmptyArray(raw []byte) json.RawMessage {
	if raw == nil {
		return json.RawMessage("[]")
	}
	return raw
}
