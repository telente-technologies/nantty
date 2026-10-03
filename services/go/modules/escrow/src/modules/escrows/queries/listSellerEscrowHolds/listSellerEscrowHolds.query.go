package listsellerescrowholds

import "github.com/google/uuid"

type Query struct {
	SellerUserId string
	AfterId      *uuid.UUID
	Limit        int
}
