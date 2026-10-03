package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ReportExportJob struct {
	ent.Schema
}

func (ReportExportJob) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ReportExportJob) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("requested_by_account_id", uuid.UUID{}).Immutable(),
		field.String("kind").NotEmpty().Immutable(),
		field.Time("from_date").Immutable(),
		field.Time("to_date").Immutable(),
		field.String("status").Default("queued"),
		field.Text("csv_content").Optional().Nillable(),
		field.Int("row_count").Default(0),
		field.String("error_message").Optional().Nillable().MaxLen(300),
		field.Time("completed_at").Optional().Nillable(),
	}
}

func (ReportExportJob) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "id").Annotations(entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}),
		index.Fields("status", "id").Annotations(entsql.IndexAnnotation{Where: "status = 'queued'"}).StorageKey("reportexport_queued"),
	}
}

type CustomerNote struct {
	ent.Schema
}

func (CustomerNote) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CustomerNote) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("buyer_account_id", uuid.UUID{}).Immutable(),
		field.UUID("author_account_id", uuid.UUID{}).Immutable(),
		field.String("author_name").Default("").MaxLen(80).Immutable(),
		field.String("body").NotEmpty().MaxLen(1000).Immutable(),
	}
}

func (CustomerNote) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "buyer_account_id", "id")}
}
