# Nantty Strategy Reports

These three reports are current internal working documents prepared on 31 October 2026. They are branded for Nantty, use founder-confirmed product rules where identified, and distinguish research facts from hypotheses and unverified implementation status. The supplied market study, SWOT and internal-review PDFs informed the report structure: editorial blue sectioning, a four-quadrant SWOT, and a decision-and-readiness review. The refreshed Nantty design uses its own cobalt, ink and white palette, a restrained circular cover motif, clear evidence tables and visible page navigation; it does not reuse the source documents' marks or claims.

| Report | Markdown source | PDF |
|---|---|---|
| Market opportunity, customer segments, competition and go-to-market | [Nantty Market Study](NANTTY_MARKET_STUDY.md) | [PDF](NANTTY_MARKET_STUDY.pdf) |
| Evidence-led strengths, weaknesses, opportunities and threats | [Nantty SWOT Analysis](NANTTY_SWOT_ANALYSIS.md) | [PDF](NANTTY_SWOT_ANALYSIS.pdf) |
| Internal business, product and prelaunch readiness review | [Nantty Internal Review](NANTTY_INTERNAL_REVIEW.md) | [PDF](NANTTY_INTERNAL_REVIEW.pdf) |

The Markdown files are the editable source of truth. Rebuild the PDFs from the repository root with Python 3, `markdown`, `beautifulsoup4` and `weasyprint` installed:

```bash
python3 scripts/render_nantty_reports.py
```

External market evidence and source limitations are listed in the Market Study; repository implementation status is source-audited and should not be interpreted as production launch or runtime verification.
