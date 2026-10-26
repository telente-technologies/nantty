package services

import (
	"entgo.io/ent/dialect/sql"

	"nantty/modules/ads/src/generated/ent"
)

func sumAs(alias, column string) ent.AggregateFunc {
	return func(selector *sql.Selector) string {
		return sql.As(sql.Sum(selector.C(column)), "sum_"+alias)
	}
}
