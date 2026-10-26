package services

import (
	"context"
	"sort"
	"strings"
	"unicode/utf16"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
)

const maximumMentionsPerComment = 20

type ResolvedMentions struct {
	Views     []types.CommentMentionView
	Persisted []map[string]any
	Notify    []string
}

func mentionStartsWithAt(unitsOfText []uint16, start, length int) bool {
	return start >= 0 && length >= 2 && start+length <= len(unitsOfText) && unitsOfText[start] == '@'
}

func (service *LiveService) ResolveCommentMentions(ctx context.Context, authorId uuid.UUID, text string, requested []types.CommentMentionInput) (ResolvedMentions, error) {
	if len(requested) > maximumMentionsPerComment {
		return ResolvedMentions{}, liveerrors.Unprocessable("TOO_MANY_MENTIONS", "You can mention at most 20 people.")
	}
	units := utf16.Encode([]rune(text))
	inBounds := make([]types.CommentMentionInput, 0, len(requested))
	for _, mention := range requested {
		if _, err := uuid.Parse(mention.UserId); err == nil && mentionStartsWithAt(units, mention.Start, mention.Length) {
			inBounds = append(inBounds, mention)
		}
	}
	sort.SliceStable(inBounds, func(left, right int) bool { return inBounds[left].Start < inBounds[right].Start })
	var candidates []types.CommentMentionInput
	furthestEnd := 0
	for _, mention := range inBounds {
		if mention.Start >= furthestEnd {
			candidates = append(candidates, mention)
			furthestEnd = mention.Start + mention.Length
		}
	}
	if len(candidates) == 0 {
		return ResolvedMentions{Views: []types.CommentMentionView{}}, nil
	}
	return service.keepMentionableTargets(ctx, authorId, candidates)
}

func (service *LiveService) keepMentionableTargets(ctx context.Context, authorId uuid.UUID, candidates []types.CommentMentionInput) (ResolvedMentions, error) {
	targetIds := make([]uuid.UUID, 0, len(candidates))
	for _, candidate := range candidates {
		targetIds = append(targetIds, uuid.MustParse(candidate.UserId))
	}
	directory, err := service.Directory.LookupParticipants(ctx, targetIds)
	if err != nil {
		return ResolvedMentions{}, err
	}
	blocked, err := service.Relations.BlockedEitherWay(ctx, authorId, targetIds)
	if err != nil {
		return ResolvedMentions{}, err
	}
	privacy, err := service.Relations.MentionPrivacyOf(ctx, targetIds)
	if err != nil {
		return ResolvedMentions{}, err
	}
	resolved := ResolvedMentions{Views: []types.CommentMentionView{}}
	notified := map[string]bool{}
	for _, candidate := range candidates {
		targetId := uuid.MustParse(candidate.UserId)
		participant, known := directory[targetId]
		if !known || targetId == authorId || blocked[targetId] {
			continue
		}
		allowed, err := service.targetAllowsMention(ctx, authorId, targetId, privacy[targetId])
		if err != nil {
			return ResolvedMentions{}, err
		}
		if !allowed {
			continue
		}
		view := types.CommentMentionView{UserId: candidate.UserId, Username: strings.TrimPrefix(participant.Username, "@"), Start: candidate.Start, Length: candidate.Length}
		resolved.Views = append(resolved.Views, view)
		resolved.Persisted = append(resolved.Persisted, map[string]any{"userId": view.UserId, "username": view.Username, "start": view.Start, "length": view.Length})
		if !notified[view.UserId] {
			notified[view.UserId] = true
			resolved.Notify = append(resolved.Notify, view.UserId)
		}
	}
	return resolved, nil
}

func (service *LiveService) targetAllowsMention(ctx context.Context, authorId, targetId uuid.UUID, setting interfaces.MentionPrivacy) (bool, error) {
	switch setting {
	case interfaces.MentionNobody:
		return false, nil
	case interfaces.MentionFollowing:
		return service.Relations.IsFollowing(ctx, targetId, authorId)
	}
	return true, nil
}
