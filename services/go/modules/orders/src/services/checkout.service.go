package services

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/checkout"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/interfaces"
	"nantty/modules/orders/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
	"nantty/platform/money"
)

type CheckoutRequest struct {
	BuyerId               uuid.UUID
	AddressId             uuid.UUID
	IdempotencyKey        string
	UseStoreCredit        bool
	PromoCodes            map[uuid.UUID]string
	PaymentModes          map[uuid.UUID]string
	DirectPaymentAccepted bool
}

func (request CheckoutRequest) Fingerprint() string {
	return container.FingerprintOfRequest(request.AddressId, request.UseStoreCredit, request.PromoCodes, request.PaymentModes, request.DirectPaymentAccepted)
}

type CheckoutService struct {
	Container *container.Container
}

var checkoutClosed = httpserver.NewApiError(http.StatusConflict, "CHECKOUT_CLOSED", "That checkout is closed. Start a new checkout.")

func (service CheckoutService) Checkout(ctx context.Context, request CheckoutRequest) (types.CheckoutResultView, error) {
	existing, err := service.Container.Client.Checkout.Query().Where(checkout.BuyerAccountID(request.BuyerId), checkout.IdempotencyKey(request.IdempotencyKey)).Only(ctx)
	if err == nil {
		return service.resume(ctx, existing, request)
	}
	if !ent.IsNotFound(err) {
		return types.CheckoutResultView{}, err
	}
	plan, err := BuildCheckoutPlan(ctx, service.Container, request.BuyerId, request.AddressId, request.UseStoreCredit, request.PromoCodes)
	if err == nil {
		err = ResolvePaymentModes(&plan, request.PaymentModes, request.DirectPaymentAccepted)
	}
	if err == nil {
		LockAffiliateCommissionRates(ctx, service.Container, &plan)
	}
	if err != nil {
		return types.CheckoutResultView{}, err
	}
	checkoutId := uuid.New()
	profiles, _ := service.Container.Users.PersonalProfilesByAccount(ctx, []uuid.UUID{request.BuyerId})
	var persisted persistedCheckout
	err = service.Container.RunInSharedTransaction(ctx, func(tx *ent.Tx, transaction *sql.Tx) error {
		reserved, reserveError := service.reserveStockWithin(ctx, transaction, plan)
		if reserveError != nil {
			return reserveError
		}
		var persistError error
		persisted, persistError = persistCheckout(ctx, service.Container, tx, request, plan, checkoutId, reserved, profiles[request.BuyerId])
		return persistError
	})
	if err != nil {
		if ent.IsConstraintError(err) {
			if concurrent, lookup := service.Container.Client.Checkout.Query().Where(checkout.BuyerAccountID(request.BuyerId), checkout.IdempotencyKey(request.IdempotencyKey)).Only(ctx); lookup == nil {
				return service.resume(ctx, concurrent, request)
			}
		}
		return types.CheckoutResultView{}, err
	}
	return service.registerAndRespond(ctx, persisted.Checkout, persisted.Groups, plan.Blocked)
}

func (service CheckoutService) reserveStockWithin(ctx context.Context, transaction *sql.Tx, plan CheckoutPlan) (map[uuid.UUID]bool, error) {
	reserved := map[uuid.UUID]bool{}
	stock, err := service.Container.Stock()
	if err != nil {
		return nil, err
	}
	for _, planned := range plan.Groups {
		lines := []commerceports.StockLine{}
		for _, line := range planned.Group.Lines {
			if line.Product.TrackInventory {
				lines = append(lines, commerceports.StockLine{VariantId: line.Product.VariantId, StoreId: line.Product.StoreId, Quantity: line.Quantity})
			}
		}
		if len(lines) == 0 {
			continue
		}
		err := stock.ReserveWithin(ctx, transaction, service.Container.Settings.DatabaseSchema, commerceports.ReserveStockRequest{
			Reference: planned.GroupId.String(), ExpiresAt: service.Container.Now().Add(service.Container.Settings.CheckoutReservationTtl), Lines: lines,
		})
		var shortage commerceports.InsufficientStockError
		if asInsufficientStock(err, &shortage) {
			failure := *ordererrors.InsufficientStock
			failure.Issues = []httpserver.ValidationIssue{{Path: "variantId", Message: shortage.VariantId.String()}}
			return nil, &failure
		}
		if err != nil {
			return nil, err
		}
		reserved[planned.GroupId] = true
	}
	return reserved, nil
}

func (service CheckoutService) resume(ctx context.Context, existing *ent.Checkout, request CheckoutRequest) (types.CheckoutResultView, error) {
	if existing.RequestHash != request.Fingerprint() {
		return types.CheckoutResultView{}, container.ErrIdempotencyKeyReused
	}
	if existing.Status == enums.CheckoutFailed || existing.Status == enums.CheckoutExpired {
		return types.CheckoutResultView{}, checkoutClosed
	}
	groups, err := service.Container.Client.OrderGroup.Query().Where(ordergroup.CheckoutID(existing.ID)).Order(ent.Asc(ordergroup.FieldID)).All(ctx)
	if err != nil {
		return types.CheckoutResultView{}, err
	}
	return service.registerAndRespond(ctx, existing, groups, nil)
}

func (service CheckoutService) registerAndRespond(ctx context.Context, row *ent.Checkout, groups []*ent.OrderGroup, blocked []uuid.UUID) (types.CheckoutResultView, error) {
	if row.Status == enums.CheckoutRegistering {
		if err := service.registerPayables(ctx, row, groups); err != nil {
			service.Container.Logger.WarnContext(ctx, "register checkout payables failed", "checkoutId", row.ID.String(), "error", err)
			if abortError := AbortCheckout(ctx, service.Container, row.ID, enums.CheckoutFailed, "Payment could not be prepared"); abortError != nil {
				return types.CheckoutResultView{}, abortError
			}
			if refusal := PaymentRegistrationRefusal(err); refusal != nil {
				if restoreError := RestoreCartOfRefusedCheckout(ctx, service.Container, groups); restoreError != nil {
					service.Container.Logger.WarnContext(ctx, "refused checkout could not restore the cart", "checkoutId", row.ID.String(), "error", restoreError)
				}
				return types.CheckoutResultView{}, refusal
			}
			return types.CheckoutResultView{}, ordererrors.PaymentServiceFailed
		}
		if err := service.Container.Client.Checkout.UpdateOneID(row.ID).SetStatus(enums.CheckoutPayable).Exec(ctx); err != nil {
			return types.CheckoutResultView{}, err
		}
	}
	views, err := BuyerOrderViews(ctx, service.Container, groups)
	if err != nil {
		return types.CheckoutResultView{}, err
	}
	skipped := make([]string, 0, len(blocked))
	for _, storeId := range blocked {
		skipped = append(skipped, storeId.String())
	}
	result := types.CheckoutResultView{
		CheckoutId: row.ID.String(), PayableCheckoutId: row.ID.String(), OrderGroups: views, Orders: views, SkippedStoreIds: skipped,
		Total: money.Money{AmountMinor: row.TotalMinor, Currency: money.CurrencyCode(row.Currency)},
	}
	if len(views) > 0 {
		result.PayableOrderId = views[0].Id
	}
	return result, nil
}

func (service CheckoutService) registerPayables(ctx context.Context, row *ent.Checkout, groups []*ent.OrderGroup) error {
	items, err := LoadItemsByGroup(ctx, service.Container, UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.ID }))
	if err != nil {
		return err
	}
	storeIds := UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.StoreID })
	catalog, err := service.Container.Catalog()
	if err != nil {
		return err
	}
	stores, err := catalog.DescribeStores(ctx, storeIds)
	if err != nil {
		return err
	}
	payables := make([]interfaces.OrderPayable, 0, len(groups))
	for _, group := range groups {
		payables = append(payables, interfaces.OrderPayable{
			OrderId: group.ID.String(), OrderReference: group.Reference, StoreId: group.StoreID.String(), SellerUserId: group.SellerAccountID.String(),
			Amount: money.Money{AmountMinor: group.TotalMinor, Currency: money.CurrencyCode(group.Currency)}, ProductSummary: summarizeItems(items[group.ID]), PaymentMode: group.PaymentMode, StoreVerified: stores[group.StoreID].Verified,
		})
	}
	return service.Container.Money.RegisterCheckoutPayables(ctx, interfaces.RegisterPayablesRequest{CheckoutId: row.ID.String(), BuyerUserId: row.BuyerAccountID.String(), Orders: payables})
}

func summarizeItems(items []*ent.OrderItem) string {
	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.ProductName)
	}
	summary := strings.Join(names, ", ")
	if len(summary) > 120 {
		summary = summary[:117] + "..."
	}
	return summary
}
