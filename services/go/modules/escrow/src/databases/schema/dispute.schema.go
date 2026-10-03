package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Dispute struct {
	ent.Schema
}

func (Dispute) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Dispute) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("escrow_id", uuid.UUID{}).Immutable(),
		field.String("order_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("opened_by_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("reason").Values("not_received", "not_as_described", "damaged", "wrong_item", "other").Immutable(),
		field.String("description").MaxLen(2000).Default("").Immutable(),
		field.Bytes("evidence_urls").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Enum("status").Values("awaiting_seller", "under_review", "resolved_refunded", "resolved_released", "closed").Default("awaiting_seller"),
		field.Time("respond_by_at").Optional().Nillable(),
		field.String("resolution_note").MaxLen(2000).Default(""),
		field.Int64("refund_amount_minor").Default(0),
		field.String("resolved_by_staff_id").MaxLen(80).Default(""),
		field.Time("resolved_at").Optional().Nillable(),
		field.Int64("version").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Dispute) Edges() []ent.Edge {
	return []ent.Edge{edge.From("escrow", Escrow.Type).Ref("disputes").Field("escrow_id").Unique().Required().Immutable()}
}

func (Dispute) Indexes() []ent.Index {
	return []ent.Index{index.Fields("escrow_id"), index.Fields("order_id"), index.Fields("status", "created_at"), index.Fields("opened_by_user_id", "created_at")}
}

type DisputeMessage struct {
	ent.Schema
}

func (DisputeMessage) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DisputeMessage) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("dispute_id", uuid.UUID{}).Immutable(),
		field.String("author_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("author_role").Values("buyer", "seller", "support").Immutable(),
		field.String("text").NotEmpty().MaxLen(2000).Immutable(),
		field.Bytes("attachment_urls").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
	}
}

func (DisputeMessage) Indexes() []ent.Index {
	return []ent.Index{index.Fields("dispute_id", "created_at")}
}

type DisputeStatusEvent struct {
	ent.Schema
}

func (DisputeStatusEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DisputeStatusEvent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("dispute_id", uuid.UUID{}).Immutable(),
		field.String("status").NotEmpty().MaxLen(40).Immutable(),
		field.String("label").NotEmpty().MaxLen(200).Immutable(),
	}
}

func (DisputeStatusEvent) Indexes() []ent.Index {
	return []ent.Index{index.Fields("dispute_id", "created_at")}
}
