package services

import (
	"path"
	"strings"

	"github.com/google/uuid"
)

const MaximumMediaBytes int64 = 500 << 20

var mediaKinds = map[string]struct{ kind, extension string }{
	"image/jpeg":      {"image", "jpg"},
	"image/png":       {"image", "png"},
	"image/webp":      {"image", "webp"},
	"image/avif":      {"image", "avif"},
	"video/mp4":       {"video", "mp4"},
	"video/quicktime": {"video", "mov"},
}

func MediaKindForMimeType(mimeType string) (kind, extension string, supported bool) {
	entry, supported := mediaKinds[strings.ToLower(mimeType)]
	return entry.kind, entry.extension, supported
}

func ObjectKeyForMedia(accountId, mediaId uuid.UUID, extension string) string {
	return path.Join("ads-media", accountId.String(), mediaId.String(), "original."+extension)
}

// SafeFileName drops any directory part and control characters; the name is only a label, never part of the object key.
func SafeFileName(name string) string {
	name = path.Base(strings.ReplaceAll(strings.TrimSpace(name), "\\", "/"))
	cleaned := strings.Map(func(character rune) rune {
		if character < 32 || character == 127 {
			return -1
		}
		return character
	}, name)
	if len(cleaned) > 200 {
		cleaned = cleaned[len(cleaned)-200:]
	}
	return cleaned
}
