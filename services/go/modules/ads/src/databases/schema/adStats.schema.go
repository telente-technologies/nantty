package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdStatsDaily struct{ ent.Schema }

func (AdStatsDaily) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdStatsDaily) Fields() []ent.Field {
	return []ent.Field{
		field.String("day").MaxLen(10).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("campaign_id", uuid.UUID{}).Immutable(),
		field.UUID("ad_group_id", uuid.UUID{}).Immutable(),
		field.UUID("ad_id", uuid.UUID{}).Immutable(),
		field.String("placement").MaxLen(20).Immutable(),
		field.String("country").MaxLen(2).Default("").Immutable(),
		field.String("region").MaxLen(12).Default("").Immutable(),
		field.String("age_band").MaxLen(8).Default("").Immutable(),
		field.String("gender").MaxLen(8).Default("").Immutable(),
		field.Int64("impressions").Default(0),
		field.Int64("qualified_impressions").Default(0),
		field.Int64("reach").Default(0),
		field.Int64("clicks").Default(0),
		field.Int64("spend_micros").Default(0),
		field.Int64("video_views").Default(0),
		field.Int64("watch_ms_total").Default(0),
		field.Int64("conversions").Default(0),
		field.Int64("conversion_value_minor").Default(0),
	}
}

func (AdStatsDaily) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("day", "ad_id", "placement", "country", "region", "age_band", "gender").Unique(),
		index.Fields("account_id", "day"),
		index.Fields("campaign_id", "day"),
	}
}
