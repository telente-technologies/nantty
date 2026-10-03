package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type IpClaim struct {
	ent.Schema
}

func (IpClaim) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (IpClaim) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("kind").Values("trademark", "counterfeit").Immutable(),
		field.Enum("status").Values("open", "needs_info", "upheld", "rejected").Default("open"),
		field.String("claimant_brand_id").MaxLen(128).Immutable(),
		field.Bytes("claimant_brand").SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.UUID("claimant_user_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("accused_seller_id", uuid.UUID{}).Immutable(),
		field.String("listing_id").MaxLen(128).Immutable(),
		field.Bytes("listing").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Enum("listing_status").Values("live", "delisted").Default("live"),
		field.String("statement").MaxLen(2000).Immutable(),
		field.String("trademark_reference").MaxLen(200).Default("").Immutable(),
		field.Bytes("evidence").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("seller_response").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("sla_due_at").Immutable(),
		field.Bytes("decision").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.UUID("strike_id", uuid.UUID{}).Optional().Nillable(),
		field.String("idempotency_key").MaxLen(128).Optional().Nillable().Immutable(),
	}
}

func (IpClaim) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("idempotency_key").Unique(),
		index.Fields("status", "sla_due_at"),
		index.Fields("accused_seller_id"),
		index.Fields("listing_id"),
	}
}
