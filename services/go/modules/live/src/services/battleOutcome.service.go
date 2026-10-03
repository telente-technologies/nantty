package services

import "sort"

type ParticipantState string

const (
	ParticipantActive    ParticipantState = "active"
	ParticipantLeft      ParticipantState = "left"
	ParticipantForfeited ParticipantState = "forfeited"
)

type ParticipantFacts struct {
	UserId        string
	State         ParticipantState
	Score         int64
	RemovedByHost bool
}

type BattleOutcome struct {
	WinnerUserIds         []string
	WinnerUserId          string
	IsTie                 bool
	WinnerTakesAllApplies bool
}

func DecideBattleOutcome(participants []ParticipantFacts, winnerTakesAll bool) BattleOutcome {
	var topScore int64
	for _, participant := range participants {
		if participant.State == ParticipantActive && participant.Score > topScore {
			topScore = participant.Score
		}
	}
	leaders := []string{}
	if topScore > 0 {
		for _, participant := range participants {
			if participant.State == ParticipantActive && participant.Score == topScore {
				leaders = append(leaders, participant.UserId)
			}
		}
	}
	outcome := BattleOutcome{WinnerUserIds: leaders, IsTie: len(leaders) != 1}
	if len(leaders) == 1 {
		outcome.WinnerUserId = leaders[0]
		outcome.WinnerTakesAllApplies = winnerTakesAll
	}
	return outcome
}

func CountActiveParticipants(participants []ParticipantFacts) int {
	count := 0
	for _, participant := range participants {
		if participant.State == ParticipantActive {
			count++
		}
	}
	return count
}

func ApplyParticipantDeparture(participants []ParticipantFacts, userId string, removedByHost bool) (changed bool) {
	for index := range participants {
		participant := &participants[index]
		if participant.UserId != userId || participant.State != ParticipantActive {
			continue
		}
		participant.State = ParticipantForfeited
		if removedByHost {
			participant.State = ParticipantLeft
			participant.RemovedByHost = true
		}
		return true
	}
	return false
}

func RankActiveParticipants(participants []ParticipantFacts) map[string]int {
	distinct := map[int64]struct{}{}
	for _, participant := range participants {
		if participant.State == ParticipantActive {
			distinct[participant.Score] = struct{}{}
		}
	}
	scores := make([]int64, 0, len(distinct))
	for score := range distinct {
		scores = append(scores, score)
	}
	sort.Slice(scores, func(left, right int) bool { return scores[left] > scores[right] })
	ranks := map[string]int{}
	for _, participant := range participants {
		if participant.State != ParticipantActive {
			ranks[participant.UserId] = 0
			continue
		}
		ranks[participant.UserId] = sort.Search(len(scores), func(index int) bool { return scores[index] <= participant.Score }) + 1
	}
	return ranks
}

type ConsentVerdict string

const (
	ConsentStillWaiting ConsentVerdict = "waiting"
	ConsentAllAccepted  ConsentVerdict = "allAccepted"
	ConsentDeclined     ConsentVerdict = "declined"
)

func JudgeWinnerTakesAllConsents(consents []string) ConsentVerdict {
	verdict := ConsentAllAccepted
	for _, consent := range consents {
		if consent == "declined" {
			return ConsentDeclined
		}
		if consent != "accepted" {
			verdict = ConsentStillWaiting
		}
	}
	return verdict
}
