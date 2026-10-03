package updateprofiledetails

type OptionalText struct {
	Present bool
	Value   *string
}

type Command struct {
	AccountId     string
	Name          *string
	Bio           *string
	Website       OptionalText
	AvatarUrl     OptionalText
	BannerUrl     OptionalText
	AvatarMediaId *string
	BannerMediaId *string
	IsPrivate     *bool
}
