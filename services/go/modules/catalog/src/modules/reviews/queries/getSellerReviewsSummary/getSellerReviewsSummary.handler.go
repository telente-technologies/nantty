package getsellerreviewssummary

import (
	"context"
	"time"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent/review"
)

type Handler struct {
	Container *container.Container
}

type TrendPoint struct {
	Month                   string `json:"month"`
	AverageRatingHundredths int    `json:"averageRatingHundredths"`
	ReviewCount             int    `json:"reviewCount"`
}

type Summary struct {
	AverageRatingHundredths int            `json:"averageRatingHundredths"`
	TotalReviews            int            `json:"totalReviews"`
	ProductReviews          int            `json:"productReviews"`
	StoreReviews            int            `json:"storeReviews"`
	Distribution            map[string]int `json:"distribution"`
	ResponseRateBasisPoints int            `json:"responseRateBasisPoints"`
	UnansweredCount         int            `json:"unansweredCount"`
	Trend                   []TrendPoint   `json:"trend"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (Summary, error) {
	rows, err := handler.Container.Client.Review.Query().Where(review.StoreID(query.StoreId), review.StatusNEQ(enums.ReviewHidden)).
		Select(review.FieldRating, review.FieldKind, review.FieldReplyBody, review.FieldCreatedAt).All(ctx)
	if err != nil {
		return Summary{}, err
	}
	summary := Summary{Distribution: map[string]int{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}, TotalReviews: len(rows), Trend: []TrendPoint{}}
	total, replied := 0, 0
	months := map[string][2]int{}
	for _, row := range rows {
		total += row.Rating
		summary.Distribution[string(rune('0'+row.Rating))]++
		if row.Kind == enums.ReviewKindProduct {
			summary.ProductReviews++
		} else {
			summary.StoreReviews++
		}
		if row.ReplyBody != nil {
			replied++
		}
		key := row.CreatedAt.UTC().Format("2006-01")
		entry := months[key]
		months[key] = [2]int{entry[0] + row.Rating, entry[1] + 1}
	}
	if len(rows) > 0 {
		summary.AverageRatingHundredths = total * 100 / len(rows)
		summary.ResponseRateBasisPoints = replied * 10_000 / len(rows)
	}
	summary.UnansweredCount = len(rows) - replied
	now := handler.Container.Now().UTC()
	for offset := 5; offset >= 0; offset-- {
		key := time.Date(now.Year(), now.Month()-time.Month(offset), 1, 0, 0, 0, 0, time.UTC).Format("2006-01")
		entry := months[key]
		point := TrendPoint{Month: key, ReviewCount: entry[1]}
		if entry[1] > 0 {
			point.AverageRatingHundredths = entry[0] * 100 / entry[1]
		}
		summary.Trend = append(summary.Trend, point)
	}
	return summary, nil
}
