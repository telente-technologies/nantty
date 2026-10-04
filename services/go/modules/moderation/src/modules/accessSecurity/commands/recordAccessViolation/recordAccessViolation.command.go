package recordaccessviolation

type Command struct {
	ViolationId       string `json:"violationId"`
	AccountId         string `json:"accountId"`
	SessionId         string `json:"sessionId"`
	DeviceId          string `json:"deviceId"`
	IpPrefix          string `json:"ipPrefix"`
	Kind              string `json:"kind"`
	RouteTemplate     string `json:"routeTemplate"`
	ResourceType      string `json:"resourceType"`
	WindowCount       int    `json:"windowCount"`
	WindowSeconds     int    `json:"windowSeconds"`
	DistinctResources int    `json:"distinctResources"`
	Threshold         int    `json:"threshold"`
	Source            string `json:"source"`
	DetectedAt        string `json:"detectedAt"`
}

type Result struct {
	Action      string `json:"action"`
	Requirement string `json:"requirement"`
	CaseId      string `json:"caseId,omitempty"`
}
