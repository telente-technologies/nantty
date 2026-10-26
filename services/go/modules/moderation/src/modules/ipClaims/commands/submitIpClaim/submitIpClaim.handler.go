package submitipclaim

import (
	"context"
	"encoding/json"
	"slices"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/ipclaim"
	ipevents "nantty/modules/moderation/src/modules/ipClaims/events"
	"nantty/modules/moderation/src/modules/ipClaims/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func invalid(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func isJsonObject(raw json.RawMessage) bool {
	var decoded map[string]any
	return json.Unmarshal(raw, &decoded) == nil && decoded != nil
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	if command.IdempotencyKey != "" {
		if existing, err := handler.Container.Client.IpClaim.Query().Where(ipclaim.IdempotencyKey(command.IdempotencyKey)).Only(ctx); err == nil {
			return Result{ClaimId: existing.ID.String(), Status: "open", Replayed: true}, nil
		} else if !ent.IsNotFound(err) {
			return Result{}, err
		}
	}
	seller, sellerErr := uuid.Parse(command.AccusedSellerId)
	statement := strings.TrimSpace(command.Statement)
	switch {
	case !slices.Contains([]string{"trademark", "counterfeit"}, command.Kind):
		return Result{}, invalid("kind", "must be trademark or counterfeit")
	case sellerErr != nil:
		return Result{}, invalid("accusedSellerId", "must be a user id")
	case command.ClaimantBrandId == "" || len(command.ClaimantBrandId) > 128 || command.ListingId == "" || len(command.ListingId) > 128:
		return Result{}, invalid("listingId", "brand and listing ids are required")
	case !isJsonObject(command.ClaimantBrand) || !isJsonObject(command.Listing):
		return Result{}, invalid("listing", "claimantBrand and listing must be objects")
	case statement == "" || len(statement) > 2000 || len(command.TrademarkReference) > 200:
		return Result{}, invalid("statement", "a statement of at most 2000 characters is required")
	}
	var evidenceItems []json.RawMessage
	if len(command.Evidence) > 0 && (json.Unmarshal(command.Evidence, &evidenceItems) != nil || len(evidenceItems) > 20) {
		return Result{}, invalid("evidence", "must be a list of at most 20 items")
	}
	var created *ent.IpClaim
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := handler.Container.Now()
		create := tx.IpClaim.Create().SetKind(ipclaim.Kind(command.Kind)).SetClaimantBrandID(command.ClaimantBrandId).SetClaimantBrand(command.ClaimantBrand).SetAccusedSellerID(seller).SetListingID(command.ListingId).SetListing(command.Listing).
			SetStatement(statement).SetTrademarkReference(command.TrademarkReference).SetSLADueAt(now.Add(services.SlaDuration)).SetCreatedAt(now)
		if len(command.Evidence) > 0 {
			create.SetEvidence(command.Evidence)
		}
		if claimant, parseErr := uuid.Parse(command.ClaimantUserId); parseErr == nil {
			create.SetClaimantUserID(claimant)
		}
		if command.IdempotencyKey != "" {
			create.SetIdempotencyKey(command.IdempotencyKey)
		}
		var saveErr error
		if created, saveErr = create.Save(ctx); saveErr != nil {
			return saveErr
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, ipevents.IpClaimReceivedType, created.ID.String(), now, ipevents.ReceivedData{ClaimId: created.ID.String(), Kind: command.Kind, AccusedSellerId: seller.String(), ListingId: command.ListingId})
	})
	if ent.IsConstraintError(err) && command.IdempotencyKey != "" {
		if existing, lookupErr := handler.Container.Client.IpClaim.Query().Where(ipclaim.IdempotencyKey(command.IdempotencyKey)).Only(ctx); lookupErr == nil {
			return Result{ClaimId: existing.ID.String(), Status: "open", Replayed: true}, nil
		}
	}
	if err != nil {
		return Result{}, err
	}
	return Result{ClaimId: created.ID.String(), Status: "open"}, nil
}
