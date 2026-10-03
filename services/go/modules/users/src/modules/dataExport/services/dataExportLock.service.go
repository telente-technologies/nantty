package services

import "entgo.io/ent/dialect/sql"

func skipLocked() sql.LockOption {
	return sql.WithLockAction(sql.SkipLocked)
}
