#!/usr/bin/env python3
"""Rebuild the Nantty investor deck with a consistent, editable visual system."""

from __future__ import annotations

import io
import tempfile
import zipfile
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.util import Inches, Pt


SOURCE = Path("/home/oyinlola/Downloads/NanttyPitchDeck.pptx")
BRAND_ARCHIVE = Path("/home/oyinlola/Desktop/zudomart/Nantty.zip")
OUT_PPTX = Path("/home/oyinlola/Downloads/NanttyPitchDeck_InvestorRefresh.pptx")

W, H = 13.333, 7.5
FONT = "Lato"

# Nantty's blue mark is the anchor; the rest of the palette is intentionally
# quiet and neutral so charts and product screenshots retain hierarchy.
INK = "11182B"
DEEP = "0D1530"
BLUE = "2029F5"
BLUE_DARK = "1822CE"
BLUE_SOFT = "E9EDFF"
SKY = "AFC2FF"
CANVAS = "F6F8FC"
WHITE = "FFFFFF"
TEXT = "171D2D"
MUTED = "667085"
MUTED_LIGHT = "A8B1C4"
LINE = "DFE5F0"
PANEL_DARK = "172345"
PALE_DARK = "202D52"


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def rect(slide, x, y, w, h, fill, radius=False, line=None, transparency=0):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    shape.fill.transparency = transparency
    if line:
        shape.line.color.rgb = rgb(line)
        shape.line.width = Pt(0.7)
    else:
        shape.line.fill.background()
    if radius:
        shape.adjustments[0] = 0.12
    return shape


def line(slide, x1, y1, x2, y2, color=LINE, width=1.0):
    shape = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2)
    )
    shape.line.color.rgb = rgb(color)
    shape.line.width = Pt(width)
    return shape


def text(slide, value, x, y, w, h, size=16, color=TEXT, bold=False,
         align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, margin=0, font=FONT,
         italic=False, tracking=None):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = Inches(margin)
    tf.margin_right = Inches(margin)
    tf.margin_top = Inches(margin)
    tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_before = Pt(0)
    p.space_after = Pt(0)
    p.line_spacing = 1.05
    run = p.add_run()
    run.text = value
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = rgb(color)
    if tracking is not None:
        run._r.get_or_add_rPr().set("spc", str(tracking))
    return box


def add_logo(slide, light_logo, dark=False, x=0.68, y=0.34, w=1.46):
    stream = io.BytesIO(light_logo if not dark else dark_logo)
    slide.shapes.add_picture(stream, Inches(x), Inches(y), width=Inches(w))


def pill(slide, label, x, y, w=None, dark=False, accent=False, size=8.5):
    if w is None:
        w = max(0.65, 0.12 * len(label) + 0.38)
    fill = BLUE if accent else (PALE_DARK if dark else BLUE_SOFT)
    color = WHITE if accent else (SKY if dark else BLUE_DARK)
    rect(slide, x, y, w, 0.28, fill, radius=True)
    text(slide, label.upper(), x + 0.11, y + 0.055, w - 0.22, 0.16,
         size=size, color=color, bold=True, valign=MSO_ANCHOR.MIDDLE)
    return w


def footer(slide, number, dark=False, note=None):
    color = MUTED_LIGHT if dark else MUTED
    line(slide, 0.68, 7.03, 12.65, 7.03, PALE_DARK if dark else LINE, 0.7)
    text(slide, "NANTTY   /   PRE-SEED   /   OCTOBER 2026", 0.7, 7.12, 4.4, 0.18,
         size=7.3, color=color, bold=True)
    if note:
        text(slide, note, 4.7, 7.10, 7.1, 0.22, size=7.1, color=color,
             align=PP_ALIGN.CENTER)
    text(slide, f"{number:02d}", 12.0, 7.09, 0.58, 0.22, size=8, color=color,
         bold=True, align=PP_ALIGN.RIGHT)


def base_slide(prs, number, section, title, sub=None, dark=False, note=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = rgb(DEEP if dark else CANVAS)
    add_logo(slide, light_logo, dark=dark, x=0.68, y=0.32, w=1.55)
    section_color = SKY if dark else BLUE
    text(slide, section.upper(), 10.08, 0.43, 2.55, 0.18, size=8.3,
         color=section_color, bold=True, align=PP_ALIGN.RIGHT)
    text(slide, title, 0.7, 1.15, 11.9, 0.66, size=27, color=WHITE if dark else INK,
         bold=True)
    if sub:
        text(slide, sub, 0.72, 1.9, 11.65, 0.44, size=12.2,
             color=MUTED_LIGHT if dark else MUTED)
    footer(slide, number, dark=dark, note=note)
    return slide


def card(slide, x, y, w, h, dark=False, fill=None, stroke=None):
    return rect(slide, x, y, w, h, fill or (PANEL_DARK if dark else WHITE),
                radius=True, line=stroke or ("2A385F" if dark else LINE))


def stat(slide, x, y, w, number, label, detail, dark=False, accent=BLUE):
    card(slide, x, y, w, 1.56, dark=dark)
    text(slide, number, x + 0.22, y + 0.2, w - 0.45, 0.52,
         size=29, color=SKY if dark else accent, bold=True)
    text(slide, label, x + 0.23, y + 0.78, w - 0.45, 0.25,
         size=11.4, color=WHITE if dark else INK, bold=True)
    text(slide, detail, x + 0.23, y + 1.1, w - 0.45, 0.34,
         size=8.6, color=MUTED_LIGHT if dark else MUTED)


def bullet(slide, title, body, x, y, w, dark=False, marker=BLUE):
    rect(slide, x, y + 0.03, 0.085, 0.085, marker, radius=True)
    text(slide, title, x + 0.2, y, w - 0.2, 0.22, size=11.2,
         color=WHITE if dark else INK, bold=True)
    text(slide, body, x + 0.2, y + 0.28, w - 0.2, 0.5, size=9.2,
         color=MUTED_LIGHT if dark else MUTED)


def main():
    global light_logo, dark_logo
    with zipfile.ZipFile(BRAND_ARCHIVE) as archive:
        light_logo = archive.read("Nantty icon-03s-02a-02.png")
        dark_logo = archive.read("Nantty icon-03s-02.png")

    source = Presentation(SOURCE)
    # Use the genuine in-app screens from the supplied presentation rather than
    # inventing product UI. Only the legacy wordmark strip in dashboard images
    # is covered in the new deck and replaced with the correct Nantty lockup.
    buyer_images = [sh.image.blob for sh in sorted(
        (sh for sh in source.slides[4].shapes
         if sh.shape_type == 13 and sh.image.size[0] < 1000),
        key=lambda sh: sh.left
    )]
    seller_images = [sh.image.blob for sh in source.slides[5].shapes
                     if sh.shape_type == 13 and sh.image.size[0] >= 2500
                     and 1.45 < sh.image.size[0] / sh.image.size[1] < 1.75]
    cover_phone = next(sh.image.blob for sh in source.slides[0].shapes
                       if sh.shape_type == 13 and sh.image.size[0] < 1000)

    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    prs.core_properties.title = "Nantty — Pre-Seed Investor Deck"
    prs.core_properties.subject = "Nigeria-first social commerce"
    prs.core_properties.author = "Nantty"
    prs.core_properties.keywords = "Nantty, social commerce, Nigeria, pre-seed"

    # 01 — Cover
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid(); s.background.fill.fore_color.rgb = rgb(DEEP)
    rect(s, 8.7, -1.0, 5.6, 8.3, "142254", radius=True)
    rect(s, 9.5, 0.15, 3.05, 6.45, "1A2A58", radius=True, line="304277")
    add_logo(s, light_logo, dark=True, x=0.72, y=0.54, w=2.05)
    pill(s, "Pre-seed · October 2026", 0.76, 1.52, 2.28, dark=True, accent=True)
    text(s, "Turn social discovery\ninto trusted commerce.", 0.76, 2.15, 7.1, 1.52,
         size=35, color=WHITE, bold=True)
    text(s, "A Nigeria-first social marketplace connecting product discovery,\ncreator influence and protected checkout.",
         0.79, 3.93, 6.55, 0.68, size=15, color="D7DEF0")
    line(s, 0.8, 5.03, 7.55, 5.03, "31416F", 0.8)
    text(s, "25", 0.8, 5.31, 0.9, 0.5, size=27, color=SKY, bold=True)
    text(s, "seller LOIs", 0.8, 5.84, 1.5, 0.25, size=9.3, color="D7DEF0")
    text(s, "500+", 2.67, 5.31, 1.5, 0.5, size=27, color=SKY, bold=True)
    text(s, "prospective buyers", 2.67, 5.84, 1.9, 0.25, size=9.3, color="D7DEF0")
    text(s, "IN BUILD", 4.88, 5.31, 1.75, 0.5, size=19, color=SKY, bold=True)
    text(s, "pre-beta development", 4.88, 5.84, 2.35, 0.25, size=8.8, color="D7DEF0")
    text(s, "Seeking $250K", 0.8, 6.48, 2.5, 0.28, size=11, color=WHITE, bold=True)
    text(s, "NIGERIA FIRST   ·   PRE-LAUNCH", 0.8, 7.05, 4.7, 0.18,
         size=7.5, color=MUTED_LIGHT, bold=True)
    # Authentic product image inside a restrained device frame.
    s.shapes.add_picture(io.BytesIO(cover_phone), Inches(10.2), Inches(0.42), height=Inches(5.9))
    pill(s, "Buyer product flow", 10.0, 6.4, 1.77, dark=True, accent=True, size=7.6)
    text(s, "19", 12.03, 7.05, 0.56, 0.18, size=8, color=MUTED_LIGHT,
         bold=True, align=PP_ALIGN.RIGHT)

    # 02 — Problem
    s = base_slide(prs, 2, "The problem", "Social commerce is normal. Trust is the gap.",
                   "The discovery channel already exists; the trust gap appears when a buyer pays.")
    stat(s, 0.7, 2.58, 3.82, "83%", "Already buying socially",
         "Nigerian consumers surveyed have purchased directly through social commerce.")
    stat(s, 4.76, 2.58, 3.82, "57%", "Scams reach social feeds",
         "Among scam victims, 57% said the incident happened on social media.")
    stat(s, 8.82, 2.58, 3.82, "51%", "Recent scam exposure",
         "Consumers reported a financial scam in the prior 12 months.")
    text(s, "TODAY", 0.78, 4.65, 0.8, 0.24, size=9, color=BLUE, bold=True)
    journey = [(1.65, "Feed discovery"), (4.55, "Orders in DMs"),
               (7.45, "Bank transfer"), (10.35, "Limited recourse")]
    for i, (x, label) in enumerate(journey):
        rect(s, x, 4.62, 2.35, 0.64, WHITE, radius=True, line=LINE)
        text(s, label, x + 0.13, 4.82, 2.08, 0.22, size=10.3, color=INK,
             bold=True, align=PP_ALIGN.CENTER)
        if i < len(journey) - 1:
            line(s, x + 2.38, 4.94, journey[i + 1][0] - 0.08, 4.94, BLUE, 1.8)
    text(s, "Source: Visa Stay Secure Nigeria 2026; survey commissioned by Visa and conducted by Wakefield Research (Jan–Feb 2026).",
         0.78, 6.1, 11.6, 0.3, size=8.4, color=MUTED)

    # 03 — Opportunity context
    s = base_slide(prs, 3, "The opportunity", "A large market with a Nigeria-first entry point",
                   "Use these figures as market context—not as a claim that Nantty can capture the whole category.")
    card(s, 0.72, 2.62, 5.1, 2.95, fill=DEEP, stroke=DEEP)
    pill(s, "Category context", 1.02, 2.94, 1.55, dark=True)
    text(s, "$12.43B", 1.02, 3.55, 4.3, 0.83, size=47, color=WHITE, bold=True)
    text(s, "Nigeria social-commerce GMV · 2026 estimate", 1.06, 4.55, 4.15, 0.36,
         size=11.2, color="D9E0F2")
    stat(s, 6.15, 2.62, 2.88, "109M", "Internet users",
         "Nigeria · October 2025", accent=BLUE)
    stat(s, 9.35, 2.62, 2.88, "39.6M", "MSME baseline",
         "96.9% classified as micro")
    rect(s, 6.15, 4.48, 6.08, 0.74, BLUE_SOFT, radius=True)
    text(s, "NEXT, AFTER NIGERIA", 6.43, 4.65, 1.85, 0.18, size=8.1,
         color=BLUE_DARK, bold=True)
    text(s, "Ghana     ·     Kenya     ·     South Africa", 8.31, 4.6, 3.5, 0.27,
         size=11, color=INK, bold=True)
    text(s, "Sources: Research and Markets (2026); DataReportal Digital 2026: Nigeria; NBS/SMEDAN MSME Survey (2020).",
         0.78, 6.08, 11.4, 0.3, size=8.4, color=MUTED)

    # 04 — Solution
    s = base_slide(prs, 4, "The solution", "One connected journey from discovery to delivery",
                   "Nantty combines social discovery with seller operations and a clearer payment path.")
    flow = [
        (0.72, "01", "DISCOVER", "Shoppable feed, short video and live shopping help buyers find products through creators and stores."),
        (4.78, "02", "BUY WITH CLARITY", "Checkout makes the payment route and protection status visible before the buyer pays."),
        (8.84, "03", "COMPLETE THE TRADE", "Orders, delivery updates and dispute handling follow one recorded transaction."),
    ]
    for i, (x, n, title, body) in enumerate(flow):
        card(s, x, 2.72, 3.78, 2.22)
        text(s, n, x + 0.24, 2.96, 0.55, 0.42, size=23, color=BLUE, bold=True)
        text(s, title, x + 0.24, 3.55, 3.25, 0.28, size=11.5, color=INK, bold=True)
        text(s, body, x + 0.24, 3.95, 3.25, 0.69, size=9.4, color=MUTED)
        if i < 2:
            line(s, x + 3.8, 3.82, x + 4.04, 3.82, BLUE, 2.0)
    rect(s, 0.73, 5.35, 11.9, 0.65, DEEP, radius=True)
    text(s, "Protection terms are shown in context.", 1.0, 5.55, 4.0, 0.21,
         size=11, color=WHITE, bold=True)
    text(s, "Escrow applies in supported Nigerian flows; elsewhere, payment and protection terms are presented separately.",
         5.0, 5.54, 7.2, 0.23, size=9.2, color="D9E0F2")

    # 05 — Buyer product
    s = base_slide(prs, 5, "Product · buyer", "Protection is part of checkout—not a promise after the fact",
                   "The buyer can see the seller, price, order state and release conditions in the product flow.")
    labels = ["PRODUCT", "CHECKOUT", "ORDER STATUS"]
    for i, image_blob in enumerate(buyer_images[:3]):
        x = 0.82 + i * 2.15
        rect(s, x - 0.06, 2.55, 1.91, 4.04, WHITE, radius=True, line=LINE)
        s.shapes.add_picture(io.BytesIO(image_blob), Inches(x), Inches(2.62), height=Inches(3.82))
        pill(s, labels[i], x + 0.1, 6.25, 1.25, size=7.1)
    text(s, "Clear steps.\nClear accountability.", 7.38, 2.72, 5.1, 1.02,
         size=27, color=INK, bold=True)
    bullet(s, "Seller and product context", "Information is visible before payment.", 7.45, 4.05, 4.85)
    bullet(s, "Payment and protection terms", "The payment route and protection status are shown at checkout.", 7.45, 4.88, 4.85)
    bullet(s, "Order milestones and recourse", "Buyers can track delivery and raise a dispute when needed.", 7.45, 5.72, 4.85)

    # 06 — Product surfaces (genuine dashboard captures, corrected lockup)
    s = base_slide(prs, 6, "Product · supply", "Tools behind the feed, built for the full trade",
                   "A product can be discovered in a post, clip, live session or store.")
    captions = [
        (0.78, "SELLER OPERATIONS", "Catalog · orders · inventory · payouts"),
        (6.86, "ADS & CREATOR DISTRIBUTION", "Product, store and profile campaigns"),
    ]
    for x, title, subline in captions:
        text(s, title, x, 2.44, 5.55, 0.22, size=9.4, color=BLUE, bold=True)
        text(s, subline, x, 2.73, 5.55, 0.24, size=9.4, color=MUTED)
    for idx, img_blob in enumerate(seller_images[:2]):
        x = 0.78 + idx * 6.08
        y, display_w, display_h = 3.12, 5.75, 3.59
        card(s, x - 0.04, y - 0.04, display_w + 0.08, display_h + 0.08)
        s.shapes.add_picture(io.BytesIO(img_blob), Inches(x), Inches(y),
                             width=Inches(display_w), height=Inches(display_h))
        # Cover only the old in-screenshot brand label, keeping the real UI and
        # its demo data intact. The correct Nantty dark lockup sits in its place.
        rect(s, x + 0.015, y + 0.015, 0.74 if idx == 0 else 0.74, 0.28,
             "0F1D50", radius=False)
        s.shapes.add_picture(io.BytesIO(dark_logo), Inches(x + 0.07), Inches(y + 0.055),
                             width=Inches(0.57))
        if idx == 1:
            text(s, "ADS", x + 0.53, y + 0.08, 0.2, 0.11, size=4.5, color=WHITE, bold=True)

    # 07 — GTM
    s = base_slide(prs, 7, "Go-to-market", "Start where demand already lives",
                   "Recruit sellers with existing audiences, then use creator-led discovery to drive repeatable demand.")
    gtm = [
        (0.72, "01", "FOUNDING SELLERS", "Bring social-first merchants with existing order volume into the launch cohort."),
        (6.82, "02", "CREATOR DISTRIBUTION", "Use product-level links and clear attribution across posts, clips and lives."),
        (0.72, "03", "BUYER CONVERSION", "Build confidence with protected checkout, delivery tracking and seller credibility."),
        (6.82, "04", "REPEAT & EXPAND", "Encourage repeat purchases; expand only after Nigeria operations are ready."),
    ]
    for x, n, title, body in gtm:
        y = 2.72 if n in ("01", "02") else 4.48
        card(s, x, y, 5.78, 1.42)
        pill(s, n, x + 0.2, y + 0.21, 0.58)
        text(s, title, x + 1.0, y + 0.2, 4.4, 0.23, size=11, color=INK, bold=True)
        text(s, body, x + 1.0, y + 0.58, 4.45, 0.58, size=9.5, color=MUTED)
    rect(s, 0.74, 6.26, 11.86, 0.42, BLUE_SOFT, radius=True)
    text(s, "Launch: Nigeria     ·     Later candidates: Ghana, Kenya and South Africa", 0.98, 6.37,
         11.3, 0.19, size=9, color=BLUE_DARK, bold=True, align=PP_ALIGN.CENTER)

    # 08 — Business model (corrected to current policy)
    s = base_slide(prs, 8, "Business model", "Monetize tools and services—not a cut of seller sales",
                   "The current model keeps store access simple and makes third-party payment costs visible.")
    model = [
        ("STORE OPENING", "$1 once", "A clear, low-friction fee to open a store."),
        ("SALES", "0% commission", "Nantty does not take a commission on completed sales."),
        ("PAYMENTS & WITHDRAWALS", "Provider-set", "Flutterwave processing and withdrawal charges apply at its published rates."),
        ("ADS & PROMOTION", "Campaign spend", "Businesses can promote products, stores or profiles; eligible placements can share revenue with creators."),
        ("CREATOR PROGRAM", "Accepted creators", "Live streams and voice Spaces are available only to creators accepted into the program."),
        ("PREMIUM & COINS", "In-app services", "Subscriptions and coin gifts add optional creator and identity features; coins are not withdrawable cash."),
    ]
    for i, (label, value, desc) in enumerate(model):
        col, row = i % 2, i // 2
        x, y = 0.72 + col * 6.08, 2.55 + row * 1.27
        card(s, x, y, 5.78, 1.04)
        text(s, label, x + 0.2, y + 0.16, 2.45, 0.2, size=8.2, color=BLUE, bold=True)
        text(s, value, x + 2.68, y + 0.14, 2.8, 0.24, size=11, color=INK, bold=True,
             align=PP_ALIGN.RIGHT)
        text(s, desc, x + 0.2, y + 0.51, 5.38, 0.38, size=8.8, color=MUTED)
    text(s, "No sales commission. Provider charges follow the payment provider’s schedule; optional product prices are subject to the final launch price sheet.",
         0.82, 6.48, 11.5, 0.28, size=8, color=MUTED)

    # 09 — Market sizing
    s = base_slide(prs, 9, "Market", "A focused wedge inside a growing category",
                   "The initial opportunity is Nigerian social commerce; expansion markets are not included in this estimate.")
    card(s, 0.72, 2.58, 7.45, 3.62, fill=DEEP, stroke=DEEP)
    pill(s, "Nigeria social-commerce GMV", 1.02, 2.88, 2.35, dark=True)
    text(s, "$12.43B", 1.02, 3.48, 5.4, 0.74, size=42, color=WHITE, bold=True)
    text(s, "2026 estimate", 1.05, 4.25, 3.5, 0.22, size=10, color="D9E0F2")
    line(s, 1.05, 4.76, 7.75, 4.76, "31416F", 0.8)
    text(s, "$20.84B", 1.05, 5.02, 3.0, 0.48, size=25, color=SKY, bold=True)
    text(s, "2031 estimate   ·   10.9% CAGR", 4.02, 5.15, 3.35, 0.23, size=9.2, color="D9E0F2")
    card(s, 8.55, 2.58, 4.05, 3.62)
    text(s, "ILLUSTRATIVE SCENARIO", 8.87, 2.93, 3.4, 0.2, size=8.5, color=BLUE, bold=True)
    text(s, "1%", 8.87, 3.54, 1.22, 0.67, size=40, color=INK, bold=True)
    text(s, "≈ $124M", 10.05, 3.68, 2.15, 0.42, size=23, color=BLUE, bold=True)
    text(s, "of the 2026 category estimate", 8.9, 4.39, 3.1, 0.25, size=10.1, color=INK, bold=True)
    text(s, "This is GMV context—not Nantty revenue, a forecast or committed market share.",
         8.9, 4.86, 3.1, 0.8, size=9.4, color=MUTED)
    text(s, "Source: Research and Markets, Nigeria Social Commerce Market Intelligence Databook, Q1 2026. Verify the licensed report before investor circulation.",
         0.8, 6.42, 11.6, 0.26, size=7.9, color=MUTED)

    # 10 — Positioning
    s = base_slide(prs, 10, "Positioning", "Connect the pieces merchants manage separately today",
                   "Nantty’s product thesis: an integrated workflow can make social discovery easier to transact and measure.")
    stages = [
        (0.72, "DISCOVERY", "Feed · clips · live"),
        (3.8, "ORDERING", "Product links · checkout"),
        (6.88, "PAYMENT", "Visible terms · protection"),
        (9.96, "OPERATIONS", "Stock · orders · delivery"),
    ]
    for i, (x, head, body) in enumerate(stages):
        card(s, x, 3.0, 2.65, 1.72)
        rect(s, x, 3.0, 2.65, 0.09, BLUE if i % 2 == 0 else BLUE_DARK)
        text(s, f"0{i+1}", x + 0.2, 3.27, 0.48, 0.24, size=11.5, color=BLUE, bold=True)
        text(s, head, x + 0.2, 3.77, 2.25, 0.23, size=10.5, color=INK, bold=True)
        text(s, body, x + 0.2, 4.17, 2.28, 0.24, size=9, color=MUTED)
        if i < 3:
            line(s, x + 2.67, 3.87, x + 3.04, 3.87, BLUE, 1.7)
    rect(s, 0.72, 5.22, 11.88, 0.75, DEEP, radius=True)
    text(s, "DISCOVERY  +  PRODUCT LINKS  +  PAYMENT CLARITY  +  SELLER OPERATIONS",
         1.0, 5.48, 11.3, 0.22, size=11, color=WHITE, bold=True, align=PP_ALIGN.CENTER)
    text(s, "Workflow comparison only—not a feature-by-feature claim about any named competitor. Capabilities vary by platform and country.",
         0.82, 6.34, 11.3, 0.25, size=8.3, color=MUTED)

    # 11 — Progress
    s = base_slide(prs, 11, "Progress", "Pre-launch validation, with product development underway",
                   "These are signed intent and stated interest—not active customers, completed orders or revenue.", dark=True)
    stat(s, 0.72, 2.7, 3.72, "25", "Seller LOIs", "Signed intent to sell at launch.", dark=True)
    stat(s, 4.8, 2.7, 3.72, "500+", "Prospective buyers", "People spoken with who expressed interest.", dark=True)
    stat(s, 8.88, 2.7, 3.72, "7 + 11", "Product surfaces + services", "Build-status figures from the supplied deck.", dark=True)
    text(s, "REMAINING PRE-LAUNCH GATES", 0.82, 4.88, 3.6, 0.22, size=8.5, color=SKY, bold=True)
    gates = ["Payment-provider sign-off", "AWS production deployment", "App-store review", "Privacy & regulatory readiness"]
    for i, item in enumerate(gates):
        x = 0.82 + i * 3.02
        rect(s, x, 5.35, 2.76, 0.69, PALE_DARK, radius=True, line="2A385F")
        text(s, item, x + 0.16, 5.57, 2.43, 0.22, size=9.1, color=WHITE, bold=True,
             align=PP_ALIGN.CENTER)
    text(s, "Company figures supplied by Nantty. Confirm LOIs, buyer-interest methodology and build status before external circulation.",
         0.82, 6.45, 11.5, 0.24, size=8.1, color=MUTED_LIGHT)

    # 12 — Financials
    s = base_slide(prs, 12, "Financial model", "A management case to test—not a revenue claim",
                   "Illustrative Year 1–3 projections from the supplied deck; no live revenue is represented here.")
    x0, y0 = 0.78, 2.48
    widths = [4.25, 2.45, 2.45, 2.45]
    headers = ["USD", "YEAR 1", "YEAR 2", "YEAR 3"]
    xx = x0
    for i, (label, width) in enumerate(zip(headers, widths)):
        rect(s, xx, y0, width, 0.52, DEEP if i else BLUE, radius=True)
        text(s, label, xx + 0.16, y0 + 0.16, width - 0.32, 0.18, size=8.5,
             color=WHITE, bold=True, align=PP_ALIGN.LEFT if i == 0 else PP_ALIGN.CENTER)
        xx += width + 0.02
    rows = [
        ("Order value (GMV)", "$1.5M", "$8M", "$30M"),
        ("Escrow fees", "$15K", "$80K", "$300K"),
        ("Plans and checkmarks", "$10K", "$70K", "$240K"),
        ("Ads, coins and gifts", "$15K", "$120K", "$460K"),
        ("Total revenue", "$40K", "$270K", "$1.0M"),
        ("Monthly burn", "$12K", "$35K", "$60K"),
    ]
    for r, row in enumerate(rows):
        y = y0 + 0.57 + r * 0.49
        xx = x0
        for i, (value, width) in enumerate(zip(row, widths)):
            fill = BLUE_SOFT if r == 4 else (WHITE if r % 2 == 0 else "F0F3F9")
            rect(s, xx, y, width, 0.45, fill, radius=True)
            text(s, value, xx + 0.15, y + 0.13, width - 0.3, 0.18, size=9.3,
                 color=BLUE_DARK if r == 4 else INK, bold=(i == 0 or r == 4),
                 align=PP_ALIGN.LEFT if i == 0 else PP_ALIGN.CENTER)
            xx += width + 0.02
    rect(s, 0.8, 6.2, 11.7, 0.46, DEEP, radius=True)
    text(s, "Diligence focus: active sellers · completed-order rate · repeat purchase · creator conversion · paid acquisition cost",
         1.0, 6.34, 11.3, 0.18, size=8.7, color=WHITE, bold=True, align=PP_ALIGN.CENTER)

    # 13 — Raise
    s = base_slide(prs, 13, "The raise", "Capital to complete and launch Nantty in Nigeria",
                   "A $250K pre-seed round is intended to fund product completion, launch readiness and the first 18 months of execution.", dark=True)
    text(s, "$250K", 0.82, 2.65, 4.5, 0.95, size=51, color=WHITE, bold=True)
    text(s, "TARGET RAISE", 0.86, 3.66, 2.5, 0.22, size=9, color=SKY, bold=True)
    text(s, "About 18 months of runway\nat roughly $12K monthly burn", 0.86, 4.12, 3.8, 0.68,
         size=13.2, color="D9E0F2", bold=True)
    use = [
        ("Seller & creator acquisition", 30), ("Team · 4 people / 18 months", 29),
        ("Legal, licensing & security", 14), ("Cloud, video & KYC operations", 11),
        ("Reserve", 10), ("Launch: payments, review & beta", 6),
    ]
    for i, (label, pct) in enumerate(use):
        y = 2.68 + i * 0.55
        text(s, label, 4.98, y + 0.05, 4.1, 0.2, size=9.3, color=WHITE, bold=True)
        rect(s, 9.1, y + 0.06, 2.45, 0.22, "28375F", radius=True)
        rect(s, 9.1, y + 0.06, 2.45 * pct / 30, 0.22, BLUE if i < 2 else "6179FF", radius=True)
        text(s, f"{pct}%", 11.75, y + 0.04, 0.54, 0.22, size=9.4, color=SKY,
             bold=True, align=PP_ALIGN.RIGHT)
    text(s, "MILESTONE", 0.86, 5.43, 2.0, 0.19, size=8.3, color=SKY, bold=True)
    text(s, "Validate trusted social commerce with founding sellers, then open a public beta in Nigeria.",
         0.86, 5.76, 3.68, 0.6, size=9.5, color="D9E0F2")
    text(s, "Founder-provided allocation and runway; not an audited budget.", 0.86, 6.34, 11.1, 0.25,
         size=8.1, color=MUTED_LIGHT)

    # 14 — Team
    s = base_slide(prs, 14, "Team", "A founder-led team with product and engineering depth",
                   "The team is building Nantty and preparing for launch; this round funds completion and market validation.")
    card(s, 0.76, 2.82, 11.82, 1.45)
    rect(s, 0.76, 2.82, 0.09, 1.45, BLUE, radius=True)
    text(s, "FOUNDER", 1.08, 3.1, 2.0, 0.19, size=8.2, color=BLUE, bold=True)
    text(s, "OLUWAYEMI OYINLOLA", 1.08, 3.46, 4.8, 0.3, size=16, color=INK, bold=True)
    text(s, "Founder with a background in software engineering, product and e-commerce.",
         6.05, 3.44, 5.95, 0.39, size=10.2, color=MUTED)
    rect(s, 0.76, 5.48, 11.8, 0.65, DEEP, radius=True)
    text(s, "CORE TEAM", 1.02, 5.71, 1.45, 0.18, size=8.4, color=SKY, bold=True)
    text(s, "1 additional developer   ·   2 designers", 2.7, 5.68, 5.4, 0.23,
         size=11, color=WHITE, bold=True)
    text(s, "Team biographies and size are founder-provided; confirm before circulation.", 0.82, 6.42,
         11.2, 0.23, size=8.2, color=MUTED)

    # 15 — Milestones
    s = base_slide(prs, 15, "Milestones", "What this round unlocks",
                   "A milestone-led path from a working product to evidence of repeatable commerce.")
    milestones = [
        ("NOW", "Product development", "Complete core flows · provider sign-off · security and compliance work"),
        ("NEXT", "Launch readiness", "AWS deployment · app review · support and operations checks"),
        ("TARGET", "Begin Nigeria beta", "Timing depends on readiness gates; date is not committed"),
        ("NEXT MARKETS", "Expand only after Nigeria evidence", "Local payment · delivery · support · regulatory readiness"),
    ]
    line(s, 1.34, 3.04, 1.34, 6.06, BLUE, 2.2)
    for i, (when, title, detail) in enumerate(milestones):
        y = 2.78 + i * 0.89
        rect(s, 1.19, y + 0.09, 0.3, 0.3, BLUE if i < 2 else BLUE_SOFT, radius=True,
             line=BLUE if i >= 2 else None)
        pill(s, when, 1.86, y + 0.07, max(1.16, len(when) * .105 + .4))
        text(s, title, 3.68, y + 0.02, 3.48, 0.25, size=10.6, color=INK, bold=True)
        text(s, detail, 7.35, y + 0.03, 4.72, 0.34, size=8.8, color=MUTED)
    text(s, "Beta timing is provisional and depends on product, payments, security, compliance and operational readiness.",
         0.82, 6.43, 11.4, 0.23, size=8.2, color=MUTED)

    # 16 — Trust appendix
    s = base_slide(prs, 16, "Appendix · trust", "Trust architecture is part of the product thesis",
                   "The described payment flow is designed to avoid Nantty taking custody of customer funds.", dark=True)
    trust = [
        (0.72, "CUSTOMER FUNDS", "Nigeria escrow is represented as a lock on the buyer’s own Flutterwave balance; Nantty does not claim to hold customer funds."),
        (4.79, "MONEY CONTROLS", "The source deck describes double-entry records, idempotency on money writes and verified payment webhooks."),
        (8.86, "DATA & SAFETY", "The source deck describes versioned consent, data export/deletion and retention by data type."),
    ]
    for x, title, body in trust:
        card(s, x, 2.85, 3.75, 2.32, dark=True)
        rect(s, x, 2.85, 0.08, 2.32, BLUE, radius=True)
        text(s, title, x + 0.24, 3.2, 3.16, 0.2, size=8.6, color=SKY, bold=True)
        text(s, body, x + 0.24, 3.68, 3.18, 1.12, size=9.4, color=WHITE)
    text(s, "Before launch: confirm provider sign-off, regulatory registrations, privacy operations and the incident-response path.",
         0.84, 5.73, 11.5, 0.38, size=10.2, color="D9E0F2", bold=True)
    text(s, "Architecture and readiness statements are from the supplied deck; confirm implementation and legal status before circulation.",
         0.84, 6.42, 11.6, 0.25, size=8.1, color=MUTED_LIGHT)

    # 17 — Validation
    s = base_slide(prs, 17, "Appendix · validation", "What the closed beta must prove",
                   "Turn the launch cohort into evidence before scaling paid acquisition or entering another market.")
    groups = [
        (0.72, "SUPPLY", ["Seller activation", "Time to first listing", "Catalog quality"]),
        (3.78, "CONVERSION", ["Product view → checkout", "Checkout completion", "Creator-link conversion"]),
        (6.84, "TRUST", ["Delivery completion", "Dispute and refund rate", "Time to resolution"]),
        (9.90, "RETENTION", ["Repeat purchase", "Seller retention", "Creator repeat posting"]),
    ]
    for x, title, rows in groups:
        card(s, x, 2.95, 2.7, 2.38)
        rect(s, x, 2.95, 2.7, 0.1, BLUE if title in ("SUPPLY", "TRUST") else BLUE_DARK)
        text(s, title, x + 0.22, 3.3, 2.2, 0.22, size=9.2, color=BLUE, bold=True)
        for i, row in enumerate(rows):
            text(s, row, x + 0.22, 3.78 + i * 0.46, 2.25, 0.23, size=9.3, color=INK,
                 bold=(i == 0))
            if i < len(rows) - 1:
                line(s, x + 0.22, 4.12 + i * 0.46, x + 2.43, 4.12 + i * 0.46, LINE, 0.6)
    rect(s, 0.74, 5.75, 11.84, 0.62, BLUE_SOFT, radius=True)
    text(s, "Report cohort definitions and denominators alongside every conversion and trust metric.",
         1.0, 5.96, 11.3, 0.2, size=10, color=BLUE_DARK, bold=True, align=PP_ALIGN.CENTER)

    # 18 — Sources
    s = base_slide(prs, 18, "Appendix · sources", "Sources, definitions and diligence notes",
                   "Market statistics are external estimates; operating metrics and plans are company-provided.")
    source_rows = [
        ("VISA · STAY SECURE NIGERIA · 2026", "83% bought directly through social; 57% of scam victims cited social media; 51% reported a financial scam in the prior year.", "visa.com.ng/about-visa/newsroom/press-releases/prl-11062026.html"),
        ("DATAREPORTAL · DIGITAL 2026: NIGERIA", "109M internet users in October 2025; 45.5% penetration.", "datareportal.com/reports/digital-2026-nigeria"),
        ("RESEARCH AND MARKETS · Q1 2026", "$12.43B estimated 2026 GMV; $20.84B estimated 2031; 10.9% CAGR.", "researchandmarkets.com/reports/5578583/nigeria-social-commerce-market-intelligence-and"),
        ("NBS / SMEDAN · MSME SURVEY · 2020", "39,654,385 enterprises at December 2020; 96.9% micro. Historical baseline only.", "nigerianstat.gov.ng/pdfuploads/MSMES.pdf"),
    ]
    for i, (label, fact, url) in enumerate(source_rows):
        col, row = i % 2, i // 2
        x, y = 0.72 + col * 6.1, 2.65 + row * 1.56
        card(s, x, y, 5.78, 1.32)
        text(s, label, x + 0.22, y + 0.18, 5.28, 0.19, size=8.1, color=BLUE, bold=True)
        text(s, fact, x + 0.22, y + 0.48, 5.27, 0.37, size=9.0, color=INK)
        text(s, url, x + 0.22, y + 0.98, 5.27, 0.18, size=7.3, color=BLUE_DARK)
    rect(s, 0.74, 6.02, 11.84, 0.47, DEEP, radius=True)
    text(s, "Verify source access, company figures, pricing, projections and plans before investor circulation.",
         0.98, 6.17, 11.4, 0.18, size=8.5, color=WHITE, bold=True, align=PP_ALIGN.CENTER)

    # 19 — Close
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid(); s.background.fill.fore_color.rgb = rgb(DEEP)
    rect(s, 8.8, -0.8, 5.1, 8.3, "142254", radius=True)
    add_logo(s, light_logo, dark=True, x=0.78, y=0.66, w=2.15)
    pill(s, "Pre-seed · Nigeria first", 0.84, 2.15, 2.23, dark=True, accent=True)
    text(s, "Let’s build trusted\ncommerce in Africa,\nstarting with Nigeria.",
         0.84, 2.75, 8.7, 2.0, size=34, color=WHITE, bold=True)
    line(s, 0.87, 5.28, 6.6, 5.28, "31416F", 0.8)
    text(s, "OLUWAYEMI OYINLOLA", 0.88, 5.62, 3.8, 0.2, size=8.5, color=SKY, bold=True)
    text(s, "Founder  ·  oyinlola@nantty.com", 0.88, 6.02, 5.0, 0.28,
         size=12, color=WHITE, bold=True)
    text(s, "NANTTY   /   PRE-SEED   /   OCTOBER 2026", 0.88, 7.05, 4.7, 0.18,
         size=7.5, color=MUTED_LIGHT, bold=True)
    pill(s, "19", 12.02, 7.0, 0.6, dark=True, size=7.3)

    OUT_PPTX.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT_PPTX)
    print(f"Created {OUT_PPTX} ({len(prs.slides)} slides)")


if __name__ == "__main__":
    main()
