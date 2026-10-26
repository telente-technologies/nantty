package events

import "nantty/modules/live/src/types"

const (
	LiveCommentCreated   = "liveComment.created"
	LiveCommentDeleted   = "liveComment.deleted"
	LiveCommentPinned    = "liveComment.pinned"
	LiveCommentUnpinned  = "liveComment.unpinned"
	LiveRoomSettingsSet  = "liveRoomSettings.updated"
	LiveViewerMuted      = "liveViewer.muted"
	LiveViewerUnmuted    = "liveViewer.unmuted"
	LiveViewerBanned     = "liveViewer.banned"
	LiveViewerUnbanned   = "liveViewer.unbanned"
	OverlaySceneUpdated  = "overlayScene.published"
	OverlaySceneHidden   = "overlayScene.unpublished"
	LiveRecordingStarted = "liveRecording.started"
	LiveRecordingDone    = "liveRecording.completed"
	LiveRecordingFailed  = "liveRecording.failed"
)

type LiveCommentCreatedEventData struct {
	LiveId           string                `json:"liveId"`
	Comment          types.LiveCommentView `json:"comment"`
	MentionedUserIds []string              `json:"mentionedUserIds"`
}

type LiveCommentChangedEventData struct {
	LiveId    string `json:"liveId"`
	CommentId string `json:"commentId"`
	ActorId   string `json:"actorId"`
}

type LiveRoomSettingsEventData struct {
	LiveId          string `json:"liveId"`
	CommentsEnabled bool   `json:"commentsEnabled"`
	SlowModeSeconds int    `json:"slowModeSeconds"`
}

type LiveViewerRestrictionEventData struct {
	LiveId    string  `json:"liveId"`
	UserId    string  `json:"userId"`
	ActorId   string  `json:"actorId"`
	ExpiresAt *string `json:"expiresAt,omitempty"`
}

type OverlaySceneEventData struct {
	LiveId   string `json:"liveId"`
	SceneId  string `json:"sceneId"`
	Revision int    `json:"revision"`
}

type LiveRecordingEventData struct {
	LiveId          string `json:"liveId"`
	HostId          string `json:"hostId"`
	RecordingId     string `json:"recordingId"`
	DurationSeconds int64  `json:"durationSeconds,omitempty"`
	SizeBytes       int64  `json:"sizeBytes,omitempty"`
	Reason          string `json:"reason,omitempty"`
}
