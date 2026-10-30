package announcements

import (
	"errors"
	"net/url"
	"strings"
)

var ErrInvalidPost = errors.New("announcement must be a public post owned by the host and reference this Space")
var ErrAlreadyBound = errors.New("Space already has an announcement")

type Post struct{ AuthorID, Text string }

// Validate checks authoritative social data, never a client-supplied author or URL.
func Validate(post Post, hostID, spaceID string) error {
	if post.AuthorID != hostID {
		return ErrInvalidPost
	}
	for _, word := range strings.Fields(post.Text) {
		link, err := url.Parse(word)
		if err != nil {
			continue
		}
		canonical := link.Scheme == "https" && (link.Host == "web.nantty.com" || link.Host == "nantty.com" || link.Host == "www.nantty.com")
		local := link.Scheme == "http" && (link.Hostname() == "localhost" || link.Hostname() == "127.0.0.1")
		if (canonical || local) && link.User == nil && link.Path == "/spaces/"+spaceID {
			return nil
		}
	}
	return ErrInvalidPost
}

// Binding returns whether this is an exact replay. A room cannot change posts.
func Binding(existing, requested string) (bool, error) {
	if existing == "" {
		return false, nil
	}
	if existing == requested {
		return true, nil
	}
	return false, ErrAlreadyBound
}
