package models

import "time"

const PriceChangeNoticeDays = 30

type RenewalPriceInput struct {
	LockedPeriodPriceMinor int64
	LockedCurrency         string
	BookPeriodPriceMinor   int64
	BookCurrency           string
	NoticedPriceMinor      int64
	NoticeEffectiveAt      *time.Time
	PeriodStartsAt         time.Time
}

type RenewalPriceDecision struct {
	PeriodPriceMinor int64
	Grandfathered    bool
	NoticeNeeded     bool
}

func DecideRenewalPrice(input RenewalPriceInput) RenewalPriceDecision {
	book := RenewalPriceDecision{PeriodPriceMinor: input.BookPeriodPriceMinor}
	if input.LockedPeriodPriceMinor <= 0 || input.LockedCurrency != input.BookCurrency || input.BookPeriodPriceMinor <= input.LockedPeriodPriceMinor {
		return book
	}
	if input.NoticedPriceMinor == input.BookPeriodPriceMinor && input.NoticeEffectiveAt != nil && !input.PeriodStartsAt.Before(*input.NoticeEffectiveAt) {
		return book
	}
	return RenewalPriceDecision{PeriodPriceMinor: input.LockedPeriodPriceMinor, Grandfathered: true, NoticeNeeded: input.NoticedPriceMinor != input.BookPeriodPriceMinor}
}

func PriceChangeEffectiveAt(noticeAt, currentPeriodEndsAt time.Time, anchorDay int, interval string) time.Time {
	earliest := noticeAt.Add(days(PriceChangeNoticeDays))
	candidate := currentPeriodEndsAt
	for candidate.Before(earliest) {
		candidate = NextPeriodEnd(candidate, anchorDay, interval)
	}
	return candidate
}

func NextPeriodEnd(previousEnd time.Time, anchorDay int, interval string) time.Time {
	months := 1
	if interval == "year" {
		months = 12
	}
	year, month := previousEnd.Year(), int(previousEnd.Month())-1+months
	year, month = year+month/12, month%12+1
	if anchorDay <= 0 {
		anchorDay = previousEnd.Day()
	}
	lastDay := time.Date(year, time.Month(month)+1, 0, 0, 0, 0, 0, previousEnd.Location()).Day()
	return time.Date(year, time.Month(month), min(anchorDay, lastDay), previousEnd.Hour(), previousEnd.Minute(), previousEnd.Second(), 0, previousEnd.Location())
}

func CardExpiresBefore(expiryMonth, expiryYear int, at time.Time) bool {
	if expiryMonth < 1 || expiryMonth > 12 || expiryYear <= 0 {
		return false
	}
	return !at.Before(time.Date(expiryYear, time.Month(expiryMonth)+1, 1, 0, 0, 0, 0, time.UTC))
}

func CardExpiryNoticeDue(expiryMonth, expiryYear int, nextChargeAt, now time.Time) bool {
	return CardExpiresBefore(expiryMonth, expiryYear, nextChargeAt) && !now.Before(nextChargeAt.Add(-days(PriceChangeNoticeDays)))
}
