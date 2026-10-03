package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LegalVersion struct {
	ent.Schema
}

func (LegalVersion) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LegalVersion) Fields() []ent.Field {
	return []ent.Field{
		field.String("document_key").MaxLen(40).Immutable(),
		field.Int("version_number").Immutable(),
		field.Enum("status").Values("draft", "in_review", "published", "superseded").Default("draft"),
		field.Text("body_markdown"),
		field.String("change_summary").MaxLen(500).Default(""),
		field.Time("effective_at"),
		field.Bool("is_material_change").Default(false),
		field.Bool("is_flagged_for_legal_review").Default(false),
		field.Bool("effective_at_is_default").Default(false),
		field.String("created_by").MaxLen(64).Immutable(),
		field.String("created_by_name").MaxLen(120).Default(""),
		field.String("submitted_by").MaxLen(64).Default(""),
		field.String("submitted_by_name").MaxLen(120).Default(""),
		field.Time("submitted_at").Optional().Nillable(),
		field.String("published_by").MaxLen(64).Default(""),
		field.String("published_by_name").MaxLen(120).Default(""),
		field.Time("published_at").Optional().Nillable(),
		field.String("returned_reason").MaxLen(1000).Default(""),
		field.Int("rolled_back_from_version_number").Optional().Nillable(),
		field.UUID("notice_id", uuid.UUID{}).Optional().Nillable(),
	}
}

func (LegalVersion) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("document_key", "version_number").Unique(),
		index.Fields("document_key").StorageKey("legalversion_one_open_per_document").Unique().Annotations(entsql.IndexWhere("status IN ('draft', 'in_review')")),
		index.Fields("status", "published_at"),
	}
}
