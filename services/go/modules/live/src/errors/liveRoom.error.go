package errors

import "net/http"

var (
	CommentsDisabled   = Api(http.StatusConflict, "COMMENTS_DISABLED", "The host turned comments off for this live.")
	CommentBlockedWord = Unprocessable("COMMENT_NOT_ALLOWED", "That comment contains words that are not allowed in this live.")
	CommentNotFound    = Api(http.StatusNotFound, "COMMENT_NOT_FOUND", "That comment could not be found.")
	ViewerMuted        = Api(http.StatusForbidden, "VIEWER_MUTED", "You are muted in this live.")
	ViewerBanned       = Api(http.StatusForbidden, "VIEWER_BANNED", "You were removed from this live.")
	LiveNotAccessible  = Api(http.StatusForbidden, "LIVE_NOT_ACCESSIBLE", "You can't join this live.")
	NotLiveModerator   = Api(http.StatusForbidden, "NOT_LIVE_MODERATOR", "Only the host or a moderator can do that.")
	CannotRestrictHost = Unprocessable("CANNOT_RESTRICT_HOST", "The host and moderators can't be muted or removed by a moderator.")
	StreamKeyMissing   = Api(http.StatusNotFound, "STREAM_KEY_NOT_FOUND", "No stream key is active for this live.")
	IngressUnavailable = Api(http.StatusBadGateway, "INGRESS_UNAVAILABLE", "The streaming service is unavailable. Try again shortly.")
	SceneNotFound      = Api(http.StatusNotFound, "SCENE_NOT_FOUND", "That overlay scene no longer exists.")
	SceneLimitReached  = Unprocessable("SCENE_LIMIT_REACHED", "A live can have at most 10 overlay scenes.")
	MainSceneProtected = Unprocessable("MAIN_SCENE_PROTECTED", "The main scene can't be deleted.")
	RecordingNotReady  = Api(http.StatusServiceUnavailable, "RECORDING_UNAVAILABLE", "Recording is not available right now.")
	InternalForbidden  = Api(http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
)

func SlowMode() error {
	return Api(http.StatusTooManyRequests, "SLOW_MODE", "Slow mode is on. Wait a moment before commenting again.")
}
