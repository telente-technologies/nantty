package listbusinesscategories

type Query struct {
	Cursor string
}

type Category struct {
	Id       string  `json:"id"`
	ParentId *string `json:"parentId"`
	Kind     string  `json:"kind"`
	Name     string  `json:"name"`
	Slug     string  `json:"slug"`
	Active   bool    `json:"active"`
}

type Page struct {
	Data       []Category `json:"data"`
	NextCursor *string    `json:"nextCursor"`
}
