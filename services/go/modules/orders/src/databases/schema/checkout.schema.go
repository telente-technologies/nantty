package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AddressSnapshot struct {
	RecipientName string  `json:"recipientName"`
	Phone         string  `json:"phone"`
	Line1         string  `json:"line1"`
	Line2         string  `json:"line2"`
	PostalCode    string  `json:"postalCode"`
	Details       string  `json:"details"`
	CountryCode   string  `json:"countryCode"`
	RegionId      *string `json:"regionId"`
	AdminAreaId   *string `json:"adminAreaId"`
	CityId        *string `json:"cityId"`
	RegionName    string  `json:"regionName"`
	AdminAreaName string  `json:"adminAreaName"`
	CityName      string  `json:"cityName"`
}

type Checkout struct {
	ent.Schema
}

func (Checkout) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Checkout) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("buyer_account_id", uuid.UUID{}).Immutable(),
		field.String("idempotency_key").NotEmpty().MaxLen(128).Immutable(),
		field.String("request_hash").NotEmpty().MaxLen(64).Immutable(),
		field.String("status").Default("registering"),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("total_minor").Immutable(),
		field.JSON("address", AddressSnapshot{}).Immutable(),
		field.Bool("stock_reserved").Default(false),
		field.Time("expires_at"),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Checkout) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("buyer_account_id", "idempotency_key").Unique(),
		index.Fields("expires_at").Annotations(entsql.IndexAnnotation{Where: "status IN ('registering', 'payable')"}).StorageKey("checkout_open_expiry"),
	}
}
