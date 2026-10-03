package services

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestOnlyTheDocumentedImageAndVideoTypesAreAccepted(t *testing.T) {
	for mime, kind := range map[string]string{"image/jpeg": "image", "image/AVIF": "image", "video/quicktime": "video"} {
		if got, _, ok := MediaKindForMimeType(mime); !ok || got != kind {
			t.Fatalf("%s should be a %s", mime, kind)
		}
	}
	for _, mime := range []string{"image/gif", "application/pdf", "text/html", ""} {
		if _, _, ok := MediaKindForMimeType(mime); ok {
			t.Fatalf("%q must be refused", mime)
		}
	}
}

func TestObjectKeysNeverContainTheClientFileName(t *testing.T) {
	account, media := uuid.New(), uuid.New()
	key := ObjectKeyForMedia(account, media, "jpg")
	if !strings.HasPrefix(key, "ads-media/"+account.String()+"/"+media.String()+"/") || strings.Contains(key, "..") {
		t.Fatalf("unexpected key %s", key)
	}
	if SafeFileName("../../etc/passwd\x00.jpg") != "passwd.jpg" {
		t.Fatalf("got %q", SafeFileName("../../etc/passwd\x00.jpg"))
	}
}
