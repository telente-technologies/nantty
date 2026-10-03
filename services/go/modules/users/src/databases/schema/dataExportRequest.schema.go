package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type DataExportRequest struct {
	ent.Schema
}

func (DataExportRequest) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DataExportRequest) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("idempotency_key").Optional().Nillable().MaxLen(128).Immutable(),
		field.Enum("status").Values("requested", "processing", "ready", "failed", "expired").Default("requested"),
		field.String("object_key").Optional().Nillable().MaxLen(300),
		field.Int64("size_bytes").Default(0),
		field.String("failure_reason").Default("").MaxLen(200),
		field.Time("claimed_at").Optional().Nillable(),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("expires_at").Optional().Nillable(),
	}
}

func (DataExportRequest) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id", "idempotency_key").Unique(),
		index.Fields("status", "created_at"),
	}
}
