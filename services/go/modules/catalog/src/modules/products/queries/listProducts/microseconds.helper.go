package listproducts

import "time"

func microsecondsToTime(microseconds int64) time.Time { return time.UnixMicro(microseconds).UTC() }
