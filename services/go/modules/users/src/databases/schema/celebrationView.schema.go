package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type CelebrationView struct {
	ent.Schema
}

func (CelebrationView) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("kind").Values("birthday", "anniversary").Immutable(),
		field.Enum("surface").Values("app", "profile", "email").Immutable(),
		field.String("local_date").NotEmpty().MaxLen(10).Immutable(),
		field.Time("created_at").Default(time.Now).Immutable(),
	}
}

func (CelebrationView) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "kind", "surface", "local_date").Unique()}
}
