package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SpaceSpeakerRequest struct{ ent.Schema }

func (SpaceSpeakerRequest) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (SpaceSpeakerRequest) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("space_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("state").Values("pending", "approved", "declined", "cancelled").Default("pending"),
		field.UUID("decided_by", uuid.UUID{}).Optional().Nillable(),
		field.Time("decided_at").Optional().Nillable(),
		field.Time("expires_at").Default(func() time.Time { return time.Now().Add(24 * time.Hour) }),
	}
}

func (SpaceSpeakerRequest) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("space_id", "account_id").Unique().Annotations(entsql.IndexWhere("state = 'pending'")),
		index.Fields("space_id", "state", "created_at"),
		index.Fields("state", "expires_at"),
	}
}
