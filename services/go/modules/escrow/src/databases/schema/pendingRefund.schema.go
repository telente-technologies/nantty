package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type PendingRefund struct {
	ent.Schema
}

func (PendingRefund) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"pending_refunds_amount_positive": "amount_minor > 0",
	})}
}

func (PendingRefund) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PendingRefund) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("escrow_id", uuid.UUID{}).Immutable(),
		field.String("order_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("request_key").NotEmpty().MaxLen(128).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Bool("full").Immutable(),
		field.String("reason").MaxLen(300).Default("").Immutable(),
		field.String("actor_type").MaxLen(20).Default("system").Immutable(),
		field.String("actor_id").MaxLen(80).Default("").Immutable(),
		field.Enum("status").Values("scheduled", "executed", "superseded", "failed").Default("scheduled"),
		field.Int("attempts").Default(0),
		field.String("last_error").MaxLen(500).Default(""),
		field.Time("executed_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (PendingRefund) Edges() []ent.Edge {
	return []ent.Edge{edge.From("escrow", Escrow.Type).Ref("pending_refunds").Field("escrow_id").Unique().Required().Immutable()}
}

func (PendingRefund) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("escrow_id", "request_key").Unique(),
		index.Fields("status", "created_at"),
	}
}
