package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdCustomAudience struct{ ent.Schema }

func (AdCustomAudience) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdCustomAudience) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(120),
		field.Enum("type").Values("store_customers", "engagers", "followers", "customer_list", "lookalike").Immutable(),
		field.Enum("status").Values("building", "ready", "too_small", "failed").Default("building"),
		field.Int64("matched_count").Default(0),
		field.Int("retention_days").Optional().Nillable(),
		field.String("description").MaxLen(300).Default(""),
		field.Bytes("params").SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.UUID("lookalike_source_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("lookalike_country_code").MaxLen(2).Default(""),
		field.Int("lookalike_similarity_percent").Default(0),
		field.String("idempotency_key").MaxLen(128).Default("").Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdCustomAudience) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id", "created_at"),
		index.Fields("account_id", "idempotency_key").Unique().Annotations(entsql.IndexWhere("idempotency_key <> ''")),
	}
}

// AdAudienceMember stores matched user ids only; hashed identifiers of unmatched people are never persisted.
type AdAudienceMember struct{ ent.Schema }

func (AdAudienceMember) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("audience_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
	}
}

func (AdAudienceMember) Indexes() []ent.Index {
	return []ent.Index{index.Fields("audience_id", "user_id").Unique(), index.Fields("user_id")}
}
