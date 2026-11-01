#!/usr/bin/env python3
"""Render Nantty's strategy reports as a cohesive, searchable editorial set."""

from pathlib import Path
import re

import markdown
from bs4 import BeautifulSoup
from weasyprint import HTML


ROOT = Path(__file__).resolve().parents[1]
REPORTS = (
    "NANTTY_MARKET_STUDY",
    "NANTTY_SWOT_ANALYSIS",
    "NANTTY_INTERNAL_REVIEW",
)
LOGO = (ROOT / "docs/assets/brand/nanttyLockup.png").as_uri()
DATE = "31 October 2026"

THEMES = {
    "NANTTY_MARKET_STUDY": {
        "kind": "Market intelligence",
        "subtitle": "A grounded read on the people, commerce habits and proof Nantty needs to earn.",
        "code": "FIELD NOTES  /  NIGERIA",
    },
    "NANTTY_SWOT_ANALYSIS": {
        "kind": "Strategic position",
        "subtitle": "Where Nantty has leverage, where execution is exposed, and what to prove next.",
        "code": "STRATEGY  /  PRE-BETA",
    },
    "NANTTY_INTERNAL_REVIEW": {
        "kind": "Founder decision brief",
        "subtitle": "A practical readiness review for a product still being built.",
        "code": "INTERNAL  /  DECISION DOCUMENT",
    },
}

CSS = r"""
@page {
  size: A4;
  margin: 18mm 18mm 19mm;
  @top-left { content: "NANTTY     /     STRATEGY OFFICE"; color: #5d6980; font: 700 7pt "DejaVu Sans", sans-serif; letter-spacing: 1.25px; }
  @top-right { content: string(report-name); color: #5d6980; font: 7pt "DejaVu Sans", sans-serif; }
  @bottom-left { content: "INTERNAL WORKING DOCUMENT     •     31 OCT 2026"; color: #7a8497; font: 6.7pt "DejaVu Sans", sans-serif; letter-spacing: .8px; }
  @bottom-right { content: counter(page, decimal-leading-zero); color: #172440; font: 700 8pt "DejaVu Sans", sans-serif; }
}
@page:first {
  margin: 0;
  @top-left { content: none; }
  @top-right { content: none; }
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
* { box-sizing: border-box; }
body { margin: 0; color: #253047; font: 9pt/1.58 "DejaVu Sans", sans-serif; }
.cover {
  width: 210mm; height: 297mm; position: relative; overflow: hidden;
  padding: 25mm 21mm 20mm; page-break-after: always;
  background: #fff; color: #111b32;
}
.cover::before { content: ""; position: absolute; top: 0; left: 0; width: 5mm; height: 100%; background: #293cff; }
.cover::after { content: ""; position: absolute; width: 100mm; height: 100mm; right: -25mm; bottom: 13mm; border: 1px solid rgba(41,60,255,.24); border-radius: 50%; }
.cover-logo { display: block; width: 105mm; height: auto; margin: 0 0 28mm; position: relative; z-index: 1; }
.cover-kicker { color: #3948d7; font-size: 8pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
.cover-title { max-width: 152mm; margin: 7mm 0 5mm; color: #101a31; font: 700 36pt/1.06 "DejaVu Serif", Georgia, serif; letter-spacing: -1.35px; }
.cover-subtitle { max-width: 126mm; color: #526078; font-size: 13pt; line-height: 1.5; }
.cover-rule { width: 23mm; height: 1.5mm; margin: 10mm 0 0; background: #293cff; }
.cover-orbit { position: absolute; width: 65mm; height: 65mm; right: 12mm; bottom: 27mm; border: 1.4mm solid #293cff; border-radius: 50%; opacity: .13; }
.cover-orbit::before { content: ""; position: absolute; width: 23mm; height: 23mm; right: 3mm; top: 2mm; border-radius: 50%; background: #f2a244; }
.cover-meta { position: absolute; left: 21mm; right: 21mm; bottom: 19mm; z-index: 2; padding-top: 5mm; border-top: .5pt solid #c7cfdd; color: #5b667b; font-size: 8pt; }
.cover-meta strong { color: #101a31; font-size: 9pt; }
.cover-code { position: absolute; right: 21mm; bottom: 19mm; color: #3948d7; font-size: 7pt; font-weight: bold; letter-spacing: 1px; }
main { padding: 0; }
h1 { display: none; }
h2 { string-set: report-name content(); color: #111d38; font: 700 19pt/1.18 "DejaVu Serif", Georgia, serif; letter-spacing: -.35px; margin: 9mm 0 3.6mm; page-break-after: avoid; }
h2::before { content: ""; display: block; width: 10mm; height: 1.1mm; margin-bottom: 3mm; background: #293cff; }
h3 { color: #3045c7; font-size: 11pt; line-height: 1.3; margin: 6mm 0 2mm; page-break-after: avoid; }
h4 { color: #46546e; font-size: 9.2pt; margin: 4.5mm 0 1.5mm; page-break-after: avoid; }
p { margin: 0 0 3.1mm; orphans: 3; widows: 3; }
li { margin: 1mm 0; }
ul, ol { margin: 1.2mm 0 4mm; padding-left: 6mm; }
strong { color: #14213b; }
a { color: #3045c7; text-decoration: none; overflow-wrap: anywhere; }
code { color: #253fc4; font: 7.2pt "DejaVu Sans Mono", monospace; background: #edf0fa; padding: .35mm .9mm; }
hr { border: 0; border-top: .55pt solid #d8deea; margin: 6mm 0; }
blockquote { margin: 5mm 0; padding: 4mm 5mm; border-left: 1.5mm solid #293cff; background: #f1f3ff; color: #182647; font: 12pt/1.45 "DejaVu Serif", Georgia, serif; }
blockquote p:last-child { margin-bottom: 0; }
.lead-paragraph { color: #172440; font: 11pt/1.56 "DejaVu Serif", Georgia, serif; padding: 3mm 0 3mm 4mm; border-left: 1mm solid #293cff; }
table { border-collapse: separate; border-spacing: 0; width: 100%; margin: 3.5mm 0 5mm; font-size: 7.35pt; line-height: 1.42; page-break-inside: auto; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th { background: #172440; color: #fff; text-align: left; font-weight: 700; }
th, td { border: 0; border-bottom: .5pt solid #dce2ed; padding: 2.4mm 2.5mm; vertical-align: top; }
td:first-child, th:first-child { border-left: .5pt solid #dce2ed; }
td:last-child, th:last-child { border-right: .5pt solid #dce2ed; }
thead tr:first-child th:first-child { border-top-left-radius: 2mm; }
thead tr:first-child th:last-child { border-top-right-radius: 2mm; }
tbody tr:nth-child(even) td { background: #f4f6fa; }
tbody tr:last-child td { border-bottom: .8pt solid #c4cddd; }
.table-note { color: #657189; font-size: 7pt; }
.evidence-strip { display: flex; gap: 3mm; margin: 6mm 0 8mm; page-break-inside: avoid; }
.evidence-card { flex: 1; min-height: 29mm; padding: 4mm 4mm 3.4mm; background: #f1f4fb; border-top: 1mm solid #293cff; }
.evidence-card:nth-child(2) { border-top-color: #f0a13c; }
.evidence-card:nth-child(3) { border-top-color: #168a91; }
.evidence-value { display: block; color: #111d38; font: 700 22pt/1 "DejaVu Serif", Georgia, serif; letter-spacing: -1px; }
.evidence-label { display: block; margin-top: 2mm; color: #273551; font-size: 7.4pt; font-weight: 700; }
.evidence-caveat { display: block; margin-top: 1mm; color: #647089; font-size: 6.5pt; line-height: 1.35; }
.evidence-caption { color: #6f7a8f; font-size: 6.6pt; margin-top: -4mm; margin-bottom: 7mm; }
.swot-matrix { border-spacing: 2.2mm; }
.swot-matrix, .swot-matrix + table { page-break-inside: avoid; }
.swot-matrix th { background: transparent; color: #192643; font-size: 9pt; padding: 0 2mm 1mm; }
.swot-matrix td { width: 50%; background: #f3f5fb !important; border: .5pt solid #dce2ed !important; border-top: 1.2mm solid #3147d6 !important; padding: 3mm !important; }
.swot-matrix th:nth-child(2) { color: #b96038; }
.swot-matrix td:nth-child(2) { border-top-color: #df7b4f !important; }
.swot-matrix + table { border-spacing: 2.2mm; }
.swot-matrix + table th { background: transparent; color: #168187; font-size: 9pt; padding: 0 2mm 1mm; }
.swot-matrix + table td { width: 50%; background: #f1f7f7 !important; border: .5pt solid #dce8e7 !important; border-top: 1.2mm solid #168a91 !important; padding: 3mm !important; }
.swot-matrix + table td:nth-child(2) { border-top-color: #bc6b42 !important; }
.decision-box { margin: 5mm 0 7mm; padding: 4mm 5mm; background: #f1f4fb; border-left: 1.2mm solid #293cff; page-break-inside: avoid; }
.decision-box .label { margin-bottom: 1.5mm; color: #3948d7; font-size: 7pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
.section-break { page-break-before: auto; }
@media print {
  .cover, .evidence-card, .decision-box, blockquote, table { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
"""


def title_from(text: str) -> str:
    match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else "Nantty Strategy Report"


def add_market_evidence(soup: BeautifulSoup) -> None:
    anchor = next((h for h in soup.find_all("h2") if h.get_text(" ", strip=True).startswith("1. Company")), None)
    if not anchor:
        return
    strip = soup.new_tag("div", attrs={"class": "evidence-strip"})
    entries = (
        ("27%", "smartphone ownership", "GSMA estimate for 2024; not Nantty reach."),
        ("58%", "mobile internet usage gap", "Connectivity does not equal active use."),
        ("179.6m", "mobile subscriptions", "NCC 2025 count; not unique people."),
    )
    for value, label, caveat in entries:
        card = soup.new_tag("div", attrs={"class": "evidence-card"})
        for cls, content in (("evidence-value", value), ("evidence-label", label), ("evidence-caveat", caveat)):
            span = soup.new_tag("span", attrs={"class": cls})
            span.string = content
            card.append(span)
        strip.append(card)
    anchor.insert_before(strip)
    caption = soup.new_tag("p", attrs={"class": "evidence-caption"})
    caption.string = "Connectivity signals frame the product constraints; they are not a market-size estimate. Sources: GSMA 2025 and NCC 2025."
    strip.insert_after(caption)


def decorate_body(name: str, body: str) -> str:
    soup = BeautifulSoup(body, "html.parser")
    first_h2 = soup.find("h2")
    if first_h2:
        first_h2["class"] = [*first_h2.get("class", []), "executive-heading"]
        first_p = first_h2.find_next_sibling("p")
        if first_p:
            first_p["class"] = [*first_p.get("class", []), "lead-paragraph"]
    if name == "NANTTY_MARKET_STUDY":
        add_market_evidence(soup)
    if name == "NANTTY_SWOT_ANALYSIS":
        first_table = soup.find("table")
        if first_table:
            first_table["class"] = [*first_table.get("class", []), "swot-matrix"]
    if name == "NANTTY_INTERNAL_REVIEW":
        recommendation = next((h for h in soup.find_all("h3") if h.get_text(" ", strip=True) == "Recommendation"), None)
        if recommendation:
            paragraph = recommendation.find_next_sibling("p")
            if paragraph:
                box = soup.new_tag("aside", attrs={"class": "decision-box"})
                label = soup.new_tag("div", attrs={"class": "label"})
                label.string = "Leadership decision"
                box.append(label)
                paragraph.wrap(box)
    return str(soup)


def render(name: str) -> None:
    source = ROOT / "product-analysis" / f"{name}.md"
    target = ROOT / "product-analysis" / f"{name}.pdf"
    text = source.read_text(encoding="utf-8")
    title = title_from(text)
    theme = THEMES[name]
    body = markdown.markdown(
        text,
        extensions=["tables", "toc", "sane_lists", "fenced_code", "smarty"],
        output_format="html5",
    )
    body = decorate_body(name, body)
    cover = f"""
      <section class="cover">
        <img class="cover-logo" src="{LOGO}" alt="Nantty">
        <div class="cover-kicker">{theme['kind']}</div>
        <div class="cover-title">{title}</div>
        <div class="cover-subtitle">{theme['subtitle']}</div>
        <div class="cover-rule"></div>
        <div class="cover-orbit" aria-hidden="true"></div>
        <div class="cover-meta"><strong>Nantty</strong><br>{DATE}<br>Pre-beta internal research</div>
        <div class="cover-code">{theme['code']}</div>
      </section>
    """
    html = f"<!doctype html><html><head><meta charset='utf-8'><title>{title}</title><style>{CSS}</style></head><body>{cover}<main>{body}</main></body></html>"
    HTML(string=html, base_url=str(ROOT)).write_pdf(target)
    print(f"{target.relative_to(ROOT)} ({target.stat().st_size:,} bytes)")


if __name__ == "__main__":
    for report in REPORTS:
        render(report)
