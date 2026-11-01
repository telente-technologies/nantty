#!/usr/bin/env python3
"""Create a concise, diligence-safe Nantty intro brief for Kairos Angels."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "product-analysis" / "NANTTY_KAIROS_INVESTOR_BRIEF.pdf"
LOGO = ROOT / "apps" / "mobile" / "assets" / "nantty-icon.png"
FONT_DIR = Path("/usr/share/fonts/truetype/lato")

INK = colors.HexColor("#11182B")
DEEP = colors.HexColor("#0D1530")
BLUE = colors.HexColor("#293CFF")
PALE = colors.HexColor("#EEF1FF")
CANVAS = colors.HexColor("#F6F8FC")
TEXT = colors.HexColor("#252E42")
MUTED = colors.HexColor("#69748A")
LINE = colors.HexColor("#DCE2EE")
WHITE = colors.white

pdfmetrics.registerFont(TTFont("Lato", str(FONT_DIR / "Lato-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Lato-Bold", str(FONT_DIR / "Lato-Bold.ttf")))


def styles():
    return {
        "eyebrow": ParagraphStyle(
            "Eyebrow", fontName="Lato-Bold", fontSize=7.5, leading=10,
            textColor=BLUE, uppercase=True, tracking=1.2,
        ),
        "title": ParagraphStyle(
            "Title", fontName="Lato-Bold", fontSize=25, leading=28,
            textColor=WHITE, alignment=TA_LEFT,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle", fontName="Lato", fontSize=10.2, leading=14,
            textColor=colors.HexColor("#D8DFF1"),
        ),
        "brand_name": ParagraphStyle(
            "BrandName", fontName="Lato-Bold", fontSize=15, leading=18,
            textColor=WHITE,
        ),
        "section": ParagraphStyle(
            "Section", fontName="Lato-Bold", fontSize=8, leading=10,
            textColor=BLUE, uppercase=True, tracking=0.8,
        ),
        "body": ParagraphStyle(
            "Body", fontName="Lato", fontSize=9, leading=13,
            textColor=TEXT,
        ),
        "card_title": ParagraphStyle(
            "CardTitle", fontName="Lato-Bold", fontSize=10, leading=12,
            textColor=INK,
        ),
        "card_body": ParagraphStyle(
            "CardBody", fontName="Lato", fontSize=8, leading=11,
            textColor=MUTED,
        ),
        "highlight": ParagraphStyle(
            "Highlight", fontName="Lato", fontSize=9.4, leading=13.5,
            textColor=INK,
        ),
        "metric": ParagraphStyle(
            "Metric", fontName="Lato-Bold", fontSize=18, leading=21,
            textColor=INK,
        ),
        "metric_label": ParagraphStyle(
            "MetricLabel", fontName="Lato", fontSize=7.5, leading=10,
            textColor=MUTED,
        ),
        "footer": ParagraphStyle(
            "Footer", fontName="Lato", fontSize=7, leading=9,
            textColor=MUTED,
        ),
    }


def page(canvas, document):
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(CANVAS)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(DEEP)
    canvas.rect(0, height - 88 * mm, width, 88 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(colors.Color(0.32, 0.42, 1, alpha=0.15))
    canvas.setLineWidth(1.2)
    canvas.circle(width - 8 * mm, height - 17 * mm, 59 * mm, stroke=1, fill=0)
    canvas.restoreState()


def card(title, body, s):
    return [Paragraph(title, s["card_title"]), Spacer(1, 2.2 * mm), Paragraph(body, s["card_body"])]


def build():
    s = styles()
    width, height = A4
    doc = BaseDocTemplate(
        str(OUTPUT), pagesize=A4, title="Nantty | Kairos Angels Investor Brief",
        author="Nantty", leftMargin=16 * mm, rightMargin=16 * mm,
        topMargin=12 * mm, bottomMargin=12 * mm,
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin, doc.width, doc.height,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="one-page",
    )
    doc.addPageTemplates([PageTemplate(id="brief", frames=frame, onPage=page)])

    mark = Image(str(LOGO), width=8 * mm, height=8 * mm)
    lockup = Table([[mark, Paragraph("Nantty", s["brand_name"])]], colWidths=[10 * mm, 23 * mm])
    lockup.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    brand = Table(
        [[lockup, Paragraph("PRE-SEED&nbsp;&nbsp; / &nbsp;&nbsp;NIGERIA&nbsp;&nbsp; / &nbsp;&nbsp;OCTOBER 2026", s["subtitle"]) ]],
        colWidths=[42 * mm, doc.width - 42 * mm], rowHeights=[12 * mm],
    )
    brand.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    story = [
        brand,
        Spacer(1, 14 * mm),
        Paragraph("A NIGERIA-FIRST SOCIAL MARKETPLACE", s["eyebrow"]),
        Spacer(1, 3 * mm),
        Paragraph("Turn social discovery<br/>into trusted commerce.", s["title"]),
        Spacer(1, 3.5 * mm),
        Paragraph(
            "Nantty is building a connected path from product discovery and creator-led recommendations to clearer checkout and order follow-through.",
            s["subtitle"],
        ),
        Spacer(1, 18 * mm),
        Paragraph("THE PRODUCT", s["section"]),
        Spacer(1, 2.4 * mm),
        Paragraph(
            "Social discovery already happens across feeds and conversations. Nantty brings product context, seller operations and the transaction journey closer together, so buyers can understand who they are buying from and what happens after payment.",
            s["body"],
        ),
        Spacer(1, 4 * mm),
    ]

    journey = Table(
        [[card("01&nbsp;&nbsp; Discover", "Shoppable social posts, creator links and seller storefronts.", s),
          card("02&nbsp;&nbsp; Buy with clarity", "Checkout surfaces payment route and protection status before payment.", s),
          card("03&nbsp;&nbsp; Complete the trade", "Order milestones and dispute handling follow a recorded transaction.", s)]],
        colWidths=[doc.width / 3] * 3,
    )
    journey.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
    ]))
    story.extend([journey, Spacer(1, 5 * mm)])

    why = Table([[
        Paragraph("WHY KAIROS ANGELS", s["section"]),
        Paragraph(
            "Kairos’ published portfolio includes Vendease (restaurant infrastructure) and Orda (fintech). That made Kairos a thoughtful firm to approach as Nantty builds commerce infrastructure for Nigerian social sellers.",
            s["highlight"],
        ),
    ]], colWidths=[40 * mm, doc.width - 40 * mm])
    why.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0, PALE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
    ]))
    story.extend([why, Spacer(1, 5 * mm)])

    model = Table([[
        [Paragraph("$1", s["metric"]), Paragraph("one-time store opening fee", s["metric_label"])],
        [Paragraph("0%", s["metric"]), Paragraph("commission on completed sales", s["metric_label"])],
        [Paragraph("Provider-set", s["card_title"]), Paragraph("payment and withdrawal fees", s["metric_label"])],
    ]], colWidths=[doc.width / 3] * 3)
    model.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    story.extend([
        Paragraph("EARLY MODEL", s["section"]), Spacer(1, 2.2 * mm), model,
        Spacer(1, 5 * mm),
    ])

    raise_row = Table([[
        [Paragraph("PRE-BETA", s["section"]), Spacer(1, 1.5 * mm),
         Paragraph("Product development is underway. Launch depends on payment-provider sign-off, production deployment, app review and privacy/regulatory readiness.", s["card_body"])],
        [Paragraph("PRE-SEED TARGET", s["section"]), Spacer(1, 1.5 * mm),
         Paragraph("$250,000 to complete launch readiness and validate the model in Nigeria.", s["highlight"])],
    ]], colWidths=[doc.width * 0.59, doc.width * 0.41])
    raise_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.extend([raise_row, Spacer(1, 5 * mm), Paragraph("WHAT THE NIGERIA BETA MUST PROVE", s["section"]), Spacer(1, 2 * mm)])

    proof = Table([[
        card("Seller activation", "Time to first listing, product quality and sellers completing setup.", s),
        card("Trusted conversion", "Checkout completion, delivery outcomes and dispute resolution.", s),
        card("Repeat behaviour", "Buyer repeat purchases and seller/creator retention by cohort.", s),
    ]], colWidths=[doc.width / 3] * 3)
    proof.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    story.extend([proof, Spacer(1, 5 * mm)])

    footer = Table([[
        Paragraph("Oluwayemi Oyinlola &nbsp;·&nbsp; Founder, Nantty", s["body"]),
        Paragraph("Nantty.com &nbsp;·&nbsp; oyinlola@nantty.com", s["footer"]),
    ]], colWidths=[doc.width * 0.58, doc.width * 0.42])
    footer.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, -1), 0.7, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.extend([
        KeepTogether(footer), Spacer(1, 2 * mm),
        Paragraph("Portfolio references: kairosangels.com. Product, model and fundraising status are company-provided; this brief makes no traction or revenue claim.", s["footer"]),
    ])

    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build()
