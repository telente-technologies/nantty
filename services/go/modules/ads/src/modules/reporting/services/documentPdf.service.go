package services

func BuildLabelledDocumentPdf(title string, lines [][2]string) []byte {
	document := &pdfDocument{}
	page := document.newPage()
	y := float64(pdfPageHeight) - pdfMargin
	page.text(pdfMargin, y, 18, true, "Zudomart Ads")
	page.text(pdfMargin, y-24, 13, false, title)
	page.line(pdfMargin, y-34, pdfPageWidth-pdfMargin)
	y -= 62
	for _, line := range lines {
		page.text(pdfMargin, y, 10, true, line[0])
		page.text(pdfMargin+pdfLabelWidth, y, 10, false, truncate(line[1], 90))
		y -= 20
	}
	return document.bytes()
}
