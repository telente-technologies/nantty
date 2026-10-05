package services

import (
	"bytes"
	"fmt"
	"strings"
)

const (
	pdfPageWidth  = 842
	pdfPageHeight = 595
)

type pdfPage struct{ content bytes.Buffer }

type pdfDocument struct{ pages []*pdfPage }

func (document *pdfDocument) newPage() *pdfPage {
	page := &pdfPage{}
	document.pages = append(document.pages, page)
	return page
}

func pdfEscape(text string) string {
	var builder strings.Builder
	for _, character := range text {
		switch {
		case character == '\\' || character == '(' || character == ')':
			builder.WriteByte('\\')
			builder.WriteRune(character)
		case character < 32 || character > 126:
			builder.WriteByte('?')
		default:
			builder.WriteRune(character)
		}
	}
	return builder.String()
}

func (page *pdfPage) text(x, y, size float64, bold bool, text string) {
	font := "F1"
	if bold {
		font = "F2"
	}
	fmt.Fprintf(&page.content, "BT /%s %.1f Tf %.1f %.1f Td (%s) Tj ET\n", font, size, x, y, pdfEscape(text))
}

func (page *pdfPage) line(x1, y, x2 float64) {
	fmt.Fprintf(&page.content, "0.8 G 0.5 w %.1f %.1f m %.1f %.1f l S\n", x1, y, x2, y)
}

func (document *pdfDocument) bytes() []byte {
	var out bytes.Buffer
	offsets := []int{}
	object := func(body string) {
		offsets = append(offsets, out.Len())
		fmt.Fprintf(&out, "%d 0 obj\n%s\nendobj\n", len(offsets), body)
	}
	out.WriteString("%PDF-1.4\n")
	pageCount := len(document.pages)
	kids := make([]string, pageCount)
	for index := range document.pages {
		kids[index] = fmt.Sprintf("%d 0 R", 5+index*2)
	}
	object("<< /Type /Catalog /Pages 2 0 R >>")
	object(fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", strings.Join(kids, " "), pageCount))
	object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
	object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
	for index, page := range document.pages {
		object(fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>", pdfPageWidth, pdfPageHeight, 6+index*2))
		object(fmt.Sprintf("<< /Length %d >>\nstream\n%sendstream", page.content.Len(), page.content.String()))
	}
	xref := out.Len()
	fmt.Fprintf(&out, "xref\n0 %d\n0000000000 65535 f \n", len(offsets)+1)
	for _, offset := range offsets {
		fmt.Fprintf(&out, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&out, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets)+1, xref)
	return out.Bytes()
}
