package services

const MinimumTargetableAudience int64 = 100

// RoundToRange turns an exact count into a coarse range so small audiences cannot be probed.
func RoundToRange(exact int64) (lower, upper int64) {
	if exact <= 0 {
		return 0, 100
	}
	scale := int64(100)
	for exact/scale >= 100 {
		scale *= 10
	}
	lower = exact * 8 / 10 / scale * scale
	upper = (exact*125/100 + scale - 1) / scale * scale
	return lower, max(upper, scale)
}

func StatusForMatchedCount(matched int64) string {
	if matched < MinimumTargetableAudience {
		return "too_small"
	}
	return "ready"
}

func LookalikeSize(countryPopulation int64, similarityPercent int) int64 {
	return countryPopulation * int64(similarityPercent) / 100
}
