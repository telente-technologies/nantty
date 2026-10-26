package savecustomerprofile

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/storecustomerprofile"
	"nantty/modules/orders/src/modules/customers/dtos"
	"nantty/modules/orders/src/services"
)

type CustomerExistsError struct {
	Customer services.CustomerView
}

func (failure CustomerExistsError) Error() string { return ordererrors.CustomerExists.Message }

type Handler struct {
	Container *container.Container
}

func cleanText(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func cleanTags(tags []string) []string {
	cleaned := []string{}
	for _, tag := range tags {
		lowered := strings.ToLower(strings.TrimSpace(tag))
		if !slices.Contains(cleaned, lowered) {
			cleaned = append(cleaned, lowered)
		}
	}
	return cleaned
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.CustomerView, error) {
	store := command.Store
	customers, err := services.LoadStoreCustomers(ctx, handler.Container, store.StoreId, store.Currency)
	if err != nil {
		return services.CustomerView{}, err
	}
	excluding := ""
	var current *services.CustomerView
	if command.CustomerId != nil {
		excluding = command.CustomerId.String()
		for index := range customers {
			if customers[index].Id == excluding {
				current = &customers[index]
			}
		}
		if current == nil {
			return services.CustomerView{}, ordererrors.CustomerNotFound
		}
	}
	input := command.Input
	input.Phone, input.Email, input.Name = cleanText(input.Phone), cleanText(input.Email), cleanText(input.Name)
	if existing, found := services.FindCustomerWithContact(customers, input.Phone, input.Email, excluding); found {
		return services.CustomerView{}, CustomerExistsError{Customer: existing}
	}
	profileId, err := handler.upsertProfile(ctx, command, input, current)
	if err != nil {
		return services.CustomerView{}, err
	}
	refreshed, err := services.LoadStoreCustomers(ctx, handler.Container, store.StoreId, store.Currency)
	if err != nil {
		return services.CustomerView{}, err
	}
	for _, customer := range refreshed {
		if customer.Id == profileId {
			customer.Notes, err = services.LoadCustomerNotes(ctx, handler.Container, store.StoreId, uuid.MustParse(customer.Id))
			return customer, err
		}
	}
	return services.CustomerView{}, ordererrors.CustomerNotFound
}

func (handler Handler) upsertProfile(ctx context.Context, command Command, input dtos.CustomerProfileInput, current *services.CustomerView) (string, error) {
	customerId := ""
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var profile *ent.StoreCustomerProfile
		if command.CustomerId != nil {
			found, err := tx.StoreCustomerProfile.Query().Where(storecustomerprofile.StoreID(command.Store.StoreId),
				storecustomerprofile.Or(storecustomerprofile.ID(*command.CustomerId), storecustomerprofile.BuyerAccountID(*command.CustomerId))).ForUpdate().Only(ctx)
			if err != nil && !ent.IsNotFound(err) {
				return err
			}
			profile = found
		}
		var saved *ent.StoreCustomerProfile
		var err error
		if profile == nil {
			create := tx.StoreCustomerProfile.Create().SetStoreID(command.Store.StoreId).SetNillablePhone(emptyAsNil(input.Phone)).SetNillableEmail(emptyAsNil(input.Email))
			if current != nil {
				create.SetBuyerAccountID(*command.CustomerId).SetName(current.Name).SetTags(current.Tags)
			}
			if input.Name != nil {
				create.SetName(*input.Name)
			}
			if input.Tags != nil {
				create.SetTags(cleanTags(*input.Tags))
			}
			if input.MarketingOptIn != nil {
				create.SetMarketingOptIn(*input.MarketingOptIn)
			}
			saved, err = create.Save(ctx)
		} else {
			update := profile.Update()
			if input.Name != nil {
				update.SetName(*input.Name)
			}
			if input.Phone != nil {
				update.SetNillablePhone(emptyAsNil(input.Phone))
				if *input.Phone == "" {
					update.ClearPhone()
				}
			}
			if input.Email != nil {
				update.SetNillableEmail(emptyAsNil(input.Email))
				if *input.Email == "" {
					update.ClearEmail()
				}
			}
			if input.Tags != nil {
				update.SetTags(cleanTags(*input.Tags))
			}
			if input.MarketingOptIn != nil {
				update.SetMarketingOptIn(*input.MarketingOptIn)
			}
			saved, err = update.Save(ctx)
		}
		if err != nil {
			return err
		}
		customerId = saved.ID.String()
		if saved.BuyerAccountID != nil {
			customerId = saved.BuyerAccountID.String()
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.customer_saved", command.Store.StoreId.String(), handler.Container.Now(),
			map[string]any{"storeId": command.Store.StoreId, "customerId": customerId, "marketingOptIn": saved.MarketingOptIn})
	})
	return customerId, err
}

func emptyAsNil(value *string) *string {
	if value == nil || *value == "" {
		return nil
	}
	return value
}
