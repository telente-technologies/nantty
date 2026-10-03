package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type LegalDocument struct {
	ent.Schema
}

func (LegalDocument) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").NotEmpty().MaxLen(40).Immutable(),
		field.String("title").MaxLen(80),
		field.String("public_path").MaxLen(120),
	}
}

func (LegalDocument) Indexes() []ent.Index {
	return []ent.Index{index.Fields("key").Unique()}
}
