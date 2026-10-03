package exportreportpdf

import getreport "zudomart/modules/ads/src/modules/reporting/queries/getReport"

type Query struct {
	Report  getreport.Query
	Columns []string
}
