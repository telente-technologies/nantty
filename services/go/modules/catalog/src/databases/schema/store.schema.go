package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Store struct {
	ent.Schema
}

func (Store) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Store) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("owner_account_id", uuid.UUID{}).Immutable(),
		field.UUID("business_profile_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.String("slug").NotEmpty().MaxLen(60),
		field.String("description").Default("").MaxLen(1000),
		field.String("logo_url").Optional().Nillable().MaxLen(500),
		field.String("banner_url").Optional().Nillable().MaxLen(500),
		field.String("country_code").NotEmpty().MaxLen(2),
		field.String("currency").NotEmpty().MaxLen(3),
		field.String("timezone").Default("Africa/Lagos").MaxLen(60),
		field.String("status").Default("active"),
		field.String("status_reason").Optional().Nillable().MaxLen(1000),
		field.Time("status_changed_at").Optional().Nillable(),
		field.UUID("brand_id", uuid.UUID{}).Optional().Nillable(),
		field.Bool("has_official_badge").Default(false),
		field.Int("follower_count").Default(0),
		field.Bool("verified").Default(false),
		field.Int64("rating_sum").Default(0),
		field.Int("rating_count").Default(0),
		field.String("moderation_visibility").Default("visible"),
		field.JSON("shipping_country_codes", []string{}).Optional(),
		field.String("locale").Default("en-NG").MaxLen(12),
		field.String("contact_phone").Default("").MaxLen(20),
		field.String("contact_email").Default("").MaxLen(120),
		field.String("contact_address").Default("").MaxLen(200),
		field.JSON("tax_rates", []StoreTaxRate{}).Optional(),
		field.Bool("prices_include_tax").Default(false),
		field.JSON("policies", StorePolicies{}).Optional(),
		field.JSON("notification_preferences", map[string]bool{}).Optional(),
		field.String("tagline").Default("").MaxLen(120),
		field.JSON("opening_hours", []StoreOpeningHours{}).Optional(),
		field.JSON("social_links", map[string]string{}).Optional(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

type StoreTaxRate struct {
	Id                   string   `json:"id"`
	Name                 string   `json:"name"`
	RateBasisPoints      int      `json:"rateBasisPoints"`
	IsDefault            bool     `json:"isDefault"`
	AppliesToCategoryIds []string `json:"appliesToCategoryIds"`
}

type StorePolicies struct {
	Returns  string `json:"returns"`
	Shipping string `json:"shipping"`
	Privacy  string `json:"privacy"`
}

type StoreOpeningHours struct {
	Weekday  string `json:"weekday"`
	IsOpen   bool   `json:"isOpen"`
	OpensAt  string `json:"opensAt"`
	ClosesAt string `json:"closesAt"`
}

func (Store) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("slug").Unique(),
		index.Fields("business_profile_id").Unique(),
		index.Fields("owner_account_id"),
		index.Fields("brand_id"),
		index.Fields("status", "id"),
	}
}

type StoreMember struct {
	ent.Schema
}

func (StoreMember) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StoreMember) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("role").NotEmpty(),
		field.JSON("permissions", []string{}).Optional(),
		field.String("status").Default("active"),
		field.JSON("location_ids", []string{}).Optional(),
		field.UUID("invited_by_account_id", uuid.UUID{}).Optional().Nillable(),
		field.Time("accepted_at").Optional().Nillable(),
		field.Time("last_active_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StoreMember) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "account_id").Unique(),
		index.Fields("account_id", "status"),
	}
}
