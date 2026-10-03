package httpserver

type CursorPage[Item any] struct {
	Data       []Item  `json:"data"`
	NextCursor *string `json:"nextCursor"`
	Total      *int64  `json:"total,omitempty"`
}

func NewCursorPage[Item any](items []Item, nextCursor string) CursorPage[Item] {
	if items == nil {
		items = []Item{}
	}
	page := CursorPage[Item]{Data: items}
	if nextCursor != "" {
		page.NextCursor = &nextCursor
	}
	return page
}
