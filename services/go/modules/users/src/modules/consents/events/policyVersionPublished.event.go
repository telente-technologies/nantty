package events

const PolicyVersionPublishedType = "policyVersion.published"

type PolicyVersionPublishedData struct {
	Kind        string `json:"kind"`
	Version     string `json:"version"`
	EffectiveAt string `json:"effectiveAt"`
	PublishedBy string `json:"publishedBy"`
}
