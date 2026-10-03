package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type BusinessDocument struct {
	ent.Schema
}

func (BusinessDocument) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (BusinessDocument) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("profile_id", uuid.UUID{}).Optional().Nillable(),
		field.Enum("kind").Values("cac_certificate", "identity", "address_proof").Immutable(),
		field.String("object_key").NotEmpty().MaxLen(300).Immutable(),
		field.String("file_name").MaxLen(200).Immutable(),
		field.String("content_type").MaxLen(100).Immutable(),
		field.Int64("size_bytes").Immutable(),
		field.Bool("is_uploaded").Default(false),
		field.Bool("is_current").Default(true),
		field.Enum("status").Values("pending", "approved", "rejected").Default("pending"),
		field.String("rejection_reason").Default("").MaxLen(1000),
		field.String("reviewed_by_name").Default("").MaxLen(120),
		field.Time("reviewed_at").Optional().Nillable(),
	}
}

func (BusinessDocument) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "kind", "is_current"), index.Fields("status", "created_at")}
}
