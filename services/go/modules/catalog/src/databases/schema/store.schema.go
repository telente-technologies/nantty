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
		field.Bool("verified").Default(false),
		field.Int64("rating_sum").Default(0),
		field.Int("rating_count").Default(0),
		field.String("moderation_visibility").Default("visible"),
		field.JSON("shipping_country_codes", []string{}).Optional(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Store) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("slug").Unique(),
		index.Fields("business_profile_id").Unique(),
		index.Fields("owner_account_id"),
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
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StoreMember) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "account_id").Unique(),
		index.Fields("account_id", "status"),
	}
}
