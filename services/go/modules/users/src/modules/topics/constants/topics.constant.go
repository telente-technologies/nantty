package constants

const (
	MinimumSelectedTopics = 3
	MaximumSelectedTopics = 20
)

type SeedTopic struct {
	Id   string
	Name string
}

var SeedTopics = []SeedTopic{
	{"fashion", "Fashion"}, {"beauty", "Beauty"}, {"tech", "Tech"}, {"gadgets", "Gadgets"}, {"home-living", "Home & Living"},
	{"kids", "Kids"}, {"parenting", "Parenting"}, {"food", "Food"}, {"fitness", "Fitness"}, {"football", "Football"},
	{"music", "Music"}, {"travel", "Travel"}, {"art-craft", "Art & Craft"}, {"deals", "Deals"},
}
