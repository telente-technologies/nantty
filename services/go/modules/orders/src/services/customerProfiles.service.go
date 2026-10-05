package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/storecustomerprofile"
	"zudomart/platform/money"
)

func applyCustomerProfiles(ctx context.Context, deployed *container.Container, storeId uuid.UUID, currency money.CurrencyCode, customers []CustomerView) ([]CustomerView, error) {
	profiles, err := deployed.Client.StoreCustomerProfile.Query().Where(storecustomerprofile.StoreID(storeId)).Order(ent.Asc(storecustomerprofile.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	byBuyer := map[string]*ent.StoreCustomerProfile{}
	for _, profile := range profiles {
		if profile.BuyerAccountID != nil {
			byBuyer[profile.BuyerAccountID.String()] = profile
			continue
		}
		manual := CustomerView{Id: profile.ID.String(), Tags: []string{}, Notes: []CustomerNoteView{}, CreatedAt: profile.CreatedAt,
			StoreCreditBalance: money.Money{Currency: currency}, TotalSpent: money.Money{Currency: currency}}
		customers = append(customers, overlayProfile(manual, profile))
	}
	for index := range customers {
		if profile, found := byBuyer[customers[index].Id]; found {
			customers[index] = overlayProfile(customers[index], profile)
		}
	}
	return customers, nil
}

func overlayProfile(customer CustomerView, profile *ent.StoreCustomerProfile) CustomerView {
	if profile.Name != "" {
		customer.Name = profile.Name
	}
	if profile.Phone != nil {
		customer.Phone = profile.Phone
	}
	if profile.Email != nil {
		customer.Email = profile.Email
	}
	if profile.Tags != nil {
		customer.Tags = profile.Tags
	}
	customer.MarketingOptIn = profile.MarketingOptIn
	return customer
}

func NormalisedPhone(phone string) string {
	digits := strings.Builder{}
	for _, character := range phone {
		if character >= '0' && character <= '9' {
			digits.WriteRune(character)
		}
	}
	text := digits.String()
	if strings.HasPrefix(text, "234") && len(text) == 13 {
		return "0" + text[3:]
	}
	return text
}

func FindCustomerWithContact(customers []CustomerView, phone, email *string, excludingId string) (CustomerView, bool) {
	for _, customer := range customers {
		if customer.Id == excludingId {
			continue
		}
		if phone != nil && *phone != "" && customer.Phone != nil && NormalisedPhone(*customer.Phone) == NormalisedPhone(*phone) {
			return customer, true
		}
		if email != nil && *email != "" && customer.Email != nil && strings.EqualFold(*customer.Email, *email) {
			return customer, true
		}
	}
	return CustomerView{}, false
}

func CustomerHasTag(customer CustomerView, tag string) bool {
	for _, candidate := range customer.Tags {
		if strings.EqualFold(candidate, tag) {
			return true
		}
	}
	return false
}
