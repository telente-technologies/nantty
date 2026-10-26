package services

import "nantty/modules/live/src/container"

type LiveService struct {
	*container.Container
}

func NewLiveService(deployed *container.Container) *LiveService {
	return &LiveService{Container: deployed}
}
