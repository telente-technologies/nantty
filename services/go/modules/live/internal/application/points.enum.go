package application

import "zudomart/modules/live/internal/ent/pointsentry"

func pointsEntryType(value string) pointsentry.Type { return pointsentry.Type(value) }
