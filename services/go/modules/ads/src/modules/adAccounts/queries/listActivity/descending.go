package listactivity

import "entgo.io/ent/dialect/sql"

func sqlDesc() func(*sql.OrderTermOptions) { return sql.OrderDesc() }
