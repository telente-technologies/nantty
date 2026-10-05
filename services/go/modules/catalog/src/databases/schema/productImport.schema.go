package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ProductImportFailure struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type ProductImportJob struct {
	ent.Schema
}

func (ProductImportJob) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProductImportJob) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("actor_account_id", uuid.UUID{}).Immutable(),
		field.UUID("location_id", uuid.UUID{}).Immutable(),
		field.String("idempotency_key").NotEmpty().MaxLen(128).Immutable(),
		field.String("request_hash").NotEmpty().MaxLen(64).Immutable(),
		field.Bytes("rows").Immutable(),
		field.Enum("status").Values("queued", "running", "completed", "failed").Default("queued"),
		field.Int("created_count").Default(0),
		field.Int("updated_count").Default(0),
		field.JSON("failures", []ProductImportFailure{}).Optional(),
		field.Time("finished_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ProductImportJob) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "idempotency_key").Unique(), index.Fields("status", "id")}
}
