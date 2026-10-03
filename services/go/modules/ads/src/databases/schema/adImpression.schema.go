package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdImpression struct{ ent.Schema }

func (AdImpression) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"ad_impressions_non_negative_money": "charge_micros >= 0 AND creator_share_micros >= 0 AND platform_share_micros >= 0 AND price_micros >= 0 AND creator_share_micros + platform_share_micros = charge_micros"})}
}

func (AdImpression) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable(),
		field.Time("served_at").Immutable(),
		field.UUID("ad_id", uuid.UUID{}).Immutable(),
		field.UUID("ad_group_id", uuid.UUID{}).Immutable(),
		field.UUID("campaign_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("user_id").MaxLen(80).Immutable(),
		field.String("session_id").MaxLen(80).Immutable(),
		field.String("placement").MaxLen(20).Immutable(),
		field.String("slot_kind").MaxLen(20).Immutable(),
		field.String("content_id").MaxLen(80).Default("").Immutable(),
		field.String("creator_user_id").MaxLen(80).Default("").Immutable(),
		field.String("country").MaxLen(2).Default("").Immutable(),
		field.String("region").MaxLen(12).Default("").Immutable(),
		field.String("age_band").MaxLen(8).Default("").Immutable(),
		field.String("gender").MaxLen(8).Default("").Immutable(),
		field.Bool("ai_generated").Default(false).Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.Enum("basis").Values("cpm", "cpc").Immutable(),
		field.Int64("price_micros").Immutable(),
		field.Int64("pctr_ppm").Immutable(),
		field.Int64("creator_share_bps").Default(0).Immutable(),
		field.Int64("creator_multiplier_bps").Default(10000).Immutable(),
		field.Time("viewed_at").Optional().Nillable(),
		field.Int("watch_ms").Default(0),
		field.Bool("completed").Default(false),
		field.Time("clicked_at").Optional().Nillable(),
		field.Int("click_count").Default(0),
		field.Bool("qualified").Default(false),
		field.Time("qualified_at").Optional().Nillable(),
		field.Enum("fraud_status").Values("pending", "clean", "invalid").Default("pending"),
		field.Float("fraud_score").Default(0),
		field.String("fraud_reason").MaxLen(60).Default(""),
		field.Int64("charge_micros").Default(0),
		field.Int64("creator_share_micros").Default(0),
		field.Int64("platform_share_micros").Default(0),
		field.UUID("settlement_batch_id", uuid.UUID{}).Optional().Nillable(),
	}
}

func (AdImpression) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("served_at").Annotations(entsql.IndexType("BRIN")),
		index.Fields("user_id", "clicked_at").Annotations(entsql.IndexWhere("clicked_at IS NOT NULL")),
		index.Fields("fraud_status", "served_at").Annotations(entsql.IndexWhere("charge_micros > 0 AND settlement_batch_id IS NULL")),
	}
}
