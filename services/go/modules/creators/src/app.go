package src

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	paymentservices "nantty/modules/payments/src/modules/gateway/services"

	"google.golang.org/grpc"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/creators/src/configs"
	"nantty/modules/creators/src/container"
	"nantty/modules/creators/src/migrations"
	affiliatecontrollers "nantty/modules/creators/src/modules/affiliates/controllers"
	affiliateroutes "nantty/modules/creators/src/modules/affiliates/routes"
	affiliateservices "nantty/modules/creators/src/modules/affiliates/services"
	branddealcontrollers "nantty/modules/creators/src/modules/brandDeals/controllers"
	branddealroutes "nantty/modules/creators/src/modules/brandDeals/routes"
	branddealservices "nantty/modules/creators/src/modules/brandDeals/services"
	moneycontrollers "nantty/modules/creators/src/modules/creatorMoney/controllers"
	moneyroutes "nantty/modules/creators/src/modules/creatorMoney/routes"
	moneyservices "nantty/modules/creators/src/modules/creatorMoney/services"
	programroutes "nantty/modules/creators/src/modules/creatorProgram/routes"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/modules/liveMoney/controllers"
	"nantty/modules/creators/src/modules/liveMoney/services"
	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	platformevents "nantty/platform/events"
	platformmoney "nantty/platform/money"
	"nantty/platform/servicemodule"
)

type Module struct {
	Container  *container.Container
	Program    programservices.CreatorProgram
	LiveMoney  services.LiveMoney
	Money      moneyservices.CreatorMoney
	Affiliates affiliateservices.Affiliates
}

func validateCreatorSubscriptionPaidEvent(paid moneyservices.CreatorSubscriptionPaid) error {
	amountCurrency, amountErr := platformmoney.ParseCurrencyCode(paid.Amount.Currency)
	shareCurrency, shareErr := platformmoney.ParseCurrencyCode(paid.CreatorShare.Currency)
	if paid.SubscriptionId == "" || paid.ChargeId == "" || paid.CreatorId == "" || paid.Kind == "" || paid.Reference == "" ||
		paid.Reference != "creator-subscription-charge:"+paid.ChargeId ||
		paid.Amount.AmountMinor <= 0 || paid.CreatorShare.AmountMinor < 0 || amountErr != nil || shareErr != nil ||
		amountCurrency != shareCurrency || paid.CreatorShare.AmountMinor > paid.Amount.AmountMinor {
		return fmt.Errorf("%w: invalid creatorSubscription.paid financial payload", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateCreatorSubscriptionRefundedEvent(refunded moneyservices.CreatorSubscriptionRefunded) error {
	recoveredCurrency, recoveredErr := platformmoney.ParseCurrencyCode(refunded.Recovered.Currency)
	shortfallCurrency, shortfallErr := platformmoney.ParseCurrencyCode(refunded.Shortfall.Currency)
	if refunded.SubscriptionId == "" || refunded.ChargeId == "" || refunded.CreatorId == "" ||
		refunded.Recovered.AmountMinor < 0 || refunded.Shortfall.AmountMinor < 0 || recoveredErr != nil || shortfallErr != nil ||
		recoveredCurrency != shortfallCurrency || refunded.Recovered.AmountMinor > math.MaxInt64-refunded.Shortfall.AmountMinor {
		return fmt.Errorf("%w: invalid creatorSubscription.refunded financial payload", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateAdCreatorEarningsPostedEvent(posted moneyservices.AdCreatorEarningsPosted) error {
	if _, err := platformmoney.ParseCurrencyCode(posted.Currency); posted.CreatorUserId == "" || posted.BatchId == "" ||
		posted.IdempotencyKey != "adCreator:"+posted.BatchId+":"+posted.CreatorUserId || posted.AmountMinor <= 0 || err != nil {
		return fmt.Errorf("%w: invalid adCreatorEarnings.posted financial payload", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateAffiliateOrderGroupEvent(orderGroupId, storeId, sellerAccountId, buyerAccountId, currency string, items []affiliateservices.AttributedItem) error {
	if orderGroupId == "" || storeId == "" || sellerAccountId == "" || buyerAccountId == "" {
		return fmt.Errorf("%w: affiliate order event is missing required order or account identifiers", platformevents.ErrPoisonMessage)
	}
	if _, err := platformmoney.ParseCurrencyCode(currency); err != nil {
		return fmt.Errorf("%w: affiliate order event has invalid currency", platformevents.ErrPoisonMessage)
	}
	for _, item := range items {
		itemCurrency := strings.ToUpper(item.Currency)
		if item.OrderItemId == "" || item.ProductId == "" || item.VariantId == "" || item.Quantity <= 0 || item.LineTotalMinor <= 0 ||
			item.AttributionId == "" || (item.AttributionSource != "post" && item.AttributionSource != "clip" && item.AttributionSource != "live" && item.AttributionSource != "link") ||
			itemCurrency != currency || (item.CommissionBps != nil && (*item.CommissionBps < 0 || *item.CommissionBps > 10_000)) {
			return fmt.Errorf("%w: affiliate order event contains an invalid attributed item", platformevents.ErrPoisonMessage)
		}
	}
	return nil
}

func validateOrderGroupCompletedAffiliateEvent(completed affiliateservices.OrderGroupCompleted) error {
	if err := validateAffiliateOrderGroupEvent(completed.OrderGroupId, completed.StoreId, completed.SellerAccountId, completed.BuyerAccountId, completed.Currency, completed.AttributedItems); err != nil {
		return err
	}
	if completed.OrderNumber == "" || completed.SubtotalMinor < 0 || completed.TotalMinor < 0 || completed.RefundedMinor < 0 || completed.RefundedMinor > completed.TotalMinor {
		return fmt.Errorf("%w: invalid orderGroup.completed amount or order number", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateOrderGroupPaidAffiliateEvent(paid affiliateservices.OrderGroupPaid) error {
	if err := validateAffiliateOrderGroupEvent(paid.OrderGroupId, paid.StoreId, paid.SellerAccountId, paid.BuyerAccountId, paid.Currency, paid.AttributedItems); err != nil {
		return err
	}
	if paid.OrderNumber == "" {
		return fmt.Errorf("%w: orderGroup.paid is missing order number", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateOrderGroupStatusChangedAffiliateEvent(changed affiliateservices.OrderGroupStatusChanged) error {
	if changed.OrderGroupId == "" || changed.From == "" || changed.To == "" {
		return fmt.Errorf("%w: orderGroup.statusChanged is missing order or transition fields", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateEscrowAffiliateRefundEvent(refund affiliateservices.EscrowRefunded) error {
	amountCurrency, amountErr := platformmoney.ParseCurrencyCode(refund.Amount.Currency)
	refundedCurrency, refundedErr := platformmoney.ParseCurrencyCode(refund.Refunded.Currency)
	if refund.OrderId == "" || refund.EscrowId == "" || refund.Status == "" || refund.Amount.AmountMinor <= 0 || refund.Refunded.AmountMinor <= 0 ||
		amountErr != nil || refundedErr != nil || amountCurrency != refundedCurrency || refund.Refunded.AmountMinor > refund.Amount.AmountMinor {
		return fmt.Errorf("%w: invalid escrow refund payload for affiliate reversal", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateCreatorApplicationApprovedEvent(accountId string) error {
	if strings.TrimSpace(accountId) == "" {
		return fmt.Errorf("%w: creatorApplication.approved is missing accountId", platformevents.ErrPoisonMessage)
	}
	return nil
}

func NewCreatorsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadCreatorsSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	module, err := StartCreatorsModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{})
	if err != nil {
		return nil, err
	}
	payments, err := paymentservices.SharedPaymentGateway()
	if err != nil {
		return nil, err
	}
	if err := module.UsePayments(payments); err != nil {
		return nil, err
	}
	loaders.RegisterMoneyGrpcService(module.RegisterGrpcServices)
	loaders.RegisterMoneyDomainEventHandler("creatorApplication.approved", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data struct {
			AccountId string `json:"accountId"`
		}
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		if err := validateCreatorApplicationApprovedEvent(data.AccountId); err != nil {
			return err
		}
		return module.Program.EnrollApprovedCreatorInDefaultTier(ctx, data.AccountId)
	})
	loaders.RegisterMoneyDomainEventHandler("creatorSubscription.paid", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var paid moneyservices.CreatorSubscriptionPaid
		if err := loaders.DecodeEventData(envelope, &paid); err != nil {
			return err
		}
		if err := validateCreatorSubscriptionPaidEvent(paid); err != nil {
			return err
		}
		return module.Money.RecordSubscriptionEarning(ctx, paid, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("creatorSubscription.refunded", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var refunded moneyservices.CreatorSubscriptionRefunded
		if err := loaders.DecodeEventData(envelope, &refunded); err != nil {
			return err
		}
		if err := validateCreatorSubscriptionRefundedEvent(refunded); err != nil {
			return err
		}
		return module.Money.ReverseSubscriptionEarning(ctx, refunded, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("adCreatorEarnings.posted", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var posted moneyservices.AdCreatorEarningsPosted
		if err := loaders.DecodeEventData(envelope, &posted); err != nil {
			return err
		}
		if err := validateAdCreatorEarningsPostedEvent(posted); err != nil {
			return err
		}
		return module.Money.PostAdRevenueShare(ctx, posted, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("orderGroup.completed", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var completed affiliateservices.OrderGroupCompleted
		if err := loaders.DecodeEventData(envelope, &completed); err != nil {
			return err
		}
		if err := validateOrderGroupCompletedAffiliateEvent(completed); err != nil {
			return err
		}
		_, err := module.Affiliates.CreditCommissionsForRelease(ctx, completed.Sale())
		return err
	})
	loaders.RegisterMoneyDomainEventHandler("orderGroup.paid", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var paid affiliateservices.OrderGroupPaid
		if err := loaders.DecodeEventData(envelope, &paid); err != nil {
			return err
		}
		if err := validateOrderGroupPaidAffiliateEvent(paid); err != nil {
			return err
		}
		_, err := module.Affiliates.RecordAwaitingAttributedSales(ctx, paid.Sale())
		return err
	})
	loaders.RegisterMoneyDomainEventHandler("orderGroup.statusChanged", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var changed affiliateservices.OrderGroupStatusChanged
		if err := loaders.DecodeEventData(envelope, &changed); err != nil {
			return err
		}
		if err := validateOrderGroupStatusChangedAffiliateEvent(changed); err != nil {
			return err
		}
		if reason, voids := changed.VoidReason(); voids {
			_, err := module.Affiliates.VoidAwaitingAttributedSales(ctx, changed.OrderGroupId, reason)
			return err
		}
		return nil
	})
	for _, eventType := range []string{"escrow.refunded", "escrow.partiallyRefunded"} {
		loaders.RegisterMoneyDomainEventHandler(eventType, func(ctx context.Context, envelope platformevents.EventEnvelope) error {
			var refund affiliateservices.EscrowRefunded
			if err := loaders.DecodeEventData(envelope, &refund); err != nil {
				return err
			}
			if err := validateEscrowAffiliateRefundEvent(refund); err != nil {
				return err
			}
			_, err := module.Affiliates.ReverseCommissionsForRefund(ctx, refund, envelope.Type)
			return err
		})
	}
	return module, nil
}

func StartCreatorsModuleWithSettings(ctx context.Context, settings configs.CreatorsSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings.Money, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	creatorsContainer := container.NewCreatorsContainer(resources, settings)
	program := programservices.CreatorProgram{Container: creatorsContainer}
	if err := program.SeedDefaultTiersWhenMissing(ctx); err != nil {
		_ = resources.Close()
		return nil, err
	}
	return &Module{
		Container: creatorsContainer, Program: program, LiveMoney: services.LiveMoney{Container: creatorsContainer, Program: program},
		Money: moneyservices.CreatorMoney{Container: creatorsContainer, Program: program}, Affiliates: affiliateservices.Affiliates{Container: creatorsContainer, Program: program, Settlement: &affiliateservices.CommissionSettlementCursor{}},
	}, nil
}

func (module *Module) RegisterGrpcServices(server *grpc.Server) {
	moneyv1.RegisterLiveMoneyServiceServer(server, controllers.LiveMoneyGrpcController{LiveMoney: module.LiveMoney, Logger: module.Container.Resources.Logger})
}

func (module *Module) Name() string { return "creators" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	programroutes.MountCreatorProgramRoutes(mux, module.Program)
	moneyroutes.MountCreatorMoneyRoutes(mux, moneycontrollers.CreatorMoneyController{Money: module.Money})
	affiliateroutes.MountAffiliatesRoutes(mux, affiliatecontrollers.AffiliatesController{Affiliates: module.Affiliates})
	branddealroutes.MountBrandDealsRoutes(mux, branddealcontrollers.BrandDealsController{Deals: branddealservices.BrandDeals{Container: module.Container, Program: module.Program}})
}

func (module *Module) UsePayments(payments *paymentservices.PaymentGateway) error {
	module.Container.Payments = payments
	module.Affiliates.Container.Payments = payments
	return module.Affiliates.RegisterMovementHandlers()
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	if module.Container.Payments != nil {
		go func() {
			ticker := time.NewTicker(time.Minute)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					module.Affiliates.SettlePendingCommissions(ctx, 100)
				}
			}
		}()
	}
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: module.Container.Resources.Database, Table: module.Container.Outbox, Now: time.Now},
		Publisher: module.Container.Resources.Publisher,
		Logger:    module.Container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error { return module.Container.Resources.Close() }
