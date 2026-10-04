package enums

const (
	ModerationVisible    = "visible"
	ModerationRestricted = "restricted"
	ModerationHidden     = "hidden"
	ModerationRemoved    = "removed"
)

func IsModerationVisibility(value string) bool {
	return value == ModerationVisible || value == ModerationRestricted || value == ModerationHidden || value == ModerationRemoved
}

func IsShownToBuyers(moderationVisibility string) bool {
	return moderationVisibility == ModerationVisible || moderationVisibility == ModerationRestricted
}
