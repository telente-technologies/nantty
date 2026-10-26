package services

import (
	"context"
	"hash/fnv"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adexperiment"
	"nantty/modules/ads/src/types"
)

type experimentSlice struct {
	experimentId string
	from, to     int
}

func (index *CandidateIndex) loadExperimentSlices(ctx context.Context, groups map[uuid.UUID]*ent.AdGroup) (map[string]experimentSlice, error) {
	ids := []uuid.UUID{}
	for _, group := range groups {
		if group.ExperimentID != nil {
			ids = append(ids, *group.ExperimentID)
		}
	}
	slices := map[string]experimentSlice{}
	if len(ids) == 0 {
		return slices, nil
	}
	experiments, err := index.Client.AdExperiment.Query().Where(adexperiment.IDIn(ids...), adexperiment.StatusEQ(adexperiment.StatusRunning)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, experiment := range experiments {
		from := 0
		for _, arm := range experiment.Arms {
			slices[arm.AdSetId] = experimentSlice{experimentId: experiment.ID.String(), from: from, to: from + arm.TrafficPercent}
			from += arm.TrafficPercent
		}
	}
	return slices, nil
}

func applyExperimentSlice(candidate *types.CandidateAd, slices map[string]experimentSlice) {
	if slice, found := slices[candidate.AdGroupId]; found {
		candidate.ExperimentId, candidate.ExperimentBucketFrom, candidate.ExperimentBucketTo = slice.experimentId, slice.from, slice.to
	}
}

func ExperimentBucket(userId, experimentId string) int {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(experimentId + ":" + userId))
	return int(hasher.Sum32() % 100)
}

func ViewerFallsInExperimentArm(candidate types.CandidateAd, userId string) bool {
	if candidate.ExperimentId == "" {
		return true
	}
	bucket := ExperimentBucket(userId, candidate.ExperimentId)
	return bucket >= candidate.ExperimentBucketFrom && bucket < candidate.ExperimentBucketTo
}
