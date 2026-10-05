package listprofilesitemappage

type Query struct {
	Page int
}

type Entry struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	UpdatedAt string `json:"updatedAt"`
}

type Result struct {
	Entries    []Entry `json:"entries"`
	TotalPages int     `json:"totalPages"`
}
