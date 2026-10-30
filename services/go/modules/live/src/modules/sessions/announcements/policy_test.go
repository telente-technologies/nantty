package announcements

import (
	"errors"
	"testing"
)

func TestAnnouncementOwnershipAndReference(t *testing.T) {
	for _, test := range []struct {
		name, author, text string
		valid              bool
	}{
		{"host announcement", "host", "Join my Space: Music\nhttps://web.nantty.com/spaces/space-1", true},
		{"other author", "other", "https://web.nantty.com/spaces/space-1", false},
		{"different room", "host", "https://web.nantty.com/spaces/space-10", false},
		{"no reference", "host", "Come and listen", false},
		{"untrusted domain", "host", "https://evil.example/spaces/space-1", false},
		{"username trick", "host", "https://web.nantty.com@evil.example/spaces/space-1", false},
		{"preview local", "host", "http://127.0.0.1:3500/spaces/space-1", true},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := Validate(Post{AuthorID: test.author, Text: test.text}, "host", "space-1")
			if (err == nil) != test.valid {
				t.Fatalf("error=%v valid=%v", err, test.valid)
			}
		})
	}
}
func TestAnnouncementBindingCannotRebind(t *testing.T) {
	if replay, err := Binding("", "post-a"); replay || err != nil {
		t.Fatalf("first attachment: %v %v", replay, err)
	}
	if replay, err := Binding("post-a", "post-a"); !replay || err != nil {
		t.Fatalf("exact replay: %v %v", replay, err)
	}
	if _, err := Binding("post-a", "post-b"); !errors.Is(err, ErrAlreadyBound) {
		t.Fatalf("rebind accepted: %v", err)
	}
}
