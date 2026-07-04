from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
OUTPUT.mkdir(parents=True, exist_ok=True)
PDF = OUTPUT / "deal-hunter-ai-b2b-partnership.pdf"

NAVY = colors.HexColor("#071426")
PANEL = colors.HexColor("#10223A")
MINT = colors.HexColor("#60F0C0")
CYAN = colors.HexColor("#67D9FF")
LIGHT = colors.HexColor("#EAF2FA")
MUTED = colors.HexColor("#A8B8C8")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=31, leading=35, textColor=LIGHT, alignment=TA_CENTER, spaceAfter=14
))
styles.add(ParagraphStyle(
    name="CoverSub", parent=styles["Normal"], fontName="Helvetica",
    fontSize=13, leading=19, textColor=MUTED, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    name="H1Dark", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=22, leading=26, textColor=NAVY, spaceAfter=12
))
styles.add(ParagraphStyle(
    name="H2Dark", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=13, leading=17, textColor=NAVY, spaceBefore=8, spaceAfter=5
))
styles.add(ParagraphStyle(
    name="BodyDark", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=10.2, leading=15, textColor=colors.HexColor("#24364A"), spaceAfter=7
))
styles.add(ParagraphStyle(
    name="Small", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.5, leading=12, textColor=colors.HexColor("#52677A")
))
styles.add(ParagraphStyle(
    name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=11, leading=16, textColor=NAVY, alignment=TA_CENTER
))

def header_footer(canvas, doc):
    canvas.saveState()
    if doc.page == 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    else:
        canvas.setFillColor(NAVY)
        canvas.rect(0, A4[1] - 13 * mm, A4[0], 13 * mm, fill=1, stroke=0)
        canvas.setFillColor(LIGHT)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(18 * mm, A4[1] - 8.5 * mm, "DEAL HUNTER AI  /  B2B PARTNERSHIP")
        canvas.setFillColor(colors.HexColor("#6D8296"))
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0] - 18 * mm, 9 * mm, f"Private beta - Page {doc.page}")
    canvas.restoreState()

def bullets(items):
    return [Paragraph(f"• {item}", styles["BodyDark"]) for item in items]

pilot = Table([
    ["Scope", "30-90 days, selected categories or territories"],
    ["Access", "Read-only API, CSV, XML, JSON, XLSX, URL or SFTP"],
    ["Orders", "No automated order placement during the pilot"],
    ["Data", "No resale or redistribution of the raw partner catalog"],
    ["Security", "Credentials stored as encrypted platform secrets"],
    ["Control", "Immediate suspension and deletion on partner request"],
], colWidths=[35 * mm, 120 * mm])
pilot.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#E9F8F3")),
    ("TEXTCOLOR", (0, 0), (-1, -1), NAVY),
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B7C8D6")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))

methods = Table([
    ["REST / SOAP API", "Incremental catalog, price and stock synchronization"],
    ["CSV / XML / JSON / XLSX", "Scheduled feed ingestion with strict validation"],
    ["URL / SFTP", "Automated retrieval with checksum and freshness monitoring"],
    ["Manual sample", "Schema validation before production credentials are shared"],
], colWidths=[48 * mm, 107 * mm])
methods.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EDF4FA")),
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("TEXTCOLOR", (0, 0), (-1, -1), NAVY),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B7C8D6")),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))

story = [
    Spacer(1, 53 * mm),
    Paragraph("DEAL HUNTER <font color='#60F0C0'>AI</font>", styles["CoverTitle"]),
    Paragraph("B2B CATALOG PARTNERSHIP", styles["CoverTitle"]),
    Spacer(1, 7 * mm),
    Paragraph(
        "A decision intelligence platform connecting professional inventory "
        "with qualified resale opportunities.",
        styles["CoverSub"]
    ),
    Spacer(1, 16 * mm),
    Table(
        [[Paragraph("<b>READ-ONLY PILOT</b><br/>No automated ordering", styles["Callout"]),
          Paragraph("<b>CONTROLLED DATA</b><br/>Contract rules respected", styles["Callout"]),
          Paragraph("<b>MEASURABLE VALUE</b><br/>Qualified demand insights", styles["Callout"])]],
        colWidths=[52 * mm] * 3,
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5FAFE")),
            ("BOX", (0, 0), (-1, -1), 0.6, CYAN),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B6DCEB")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ])
    ),
    Spacer(1, 21 * mm),
    Paragraph("Private beta - Switzerland", styles["CoverSub"]),
    Paragraph("deal-hunter-ai.vercel.app  |  dealhunter680@gmail.com", styles["CoverSub"]),
    PageBreak(),

    Paragraph("Partnership proposal", styles["H1Dark"]),
    Paragraph(
        "Deal Hunter AI helps professional resellers evaluate opportunities before committing capital. "
        "The platform combines supplier cost, logistics, duties, taxes, resale fees, market evidence "
        "and risk signals into a documented decision.",
        styles["BodyDark"]
    ),
    Paragraph("What we request", styles["H2Dark"]),
    *bullets([
        "A time-limited read-only catalog feed or API sandbox.",
        "Product identifiers, professional prices, stock, images and permitted descriptions.",
        "Shipping rules, minimum order quantities, return terms and geographic restrictions.",
        "A technical contact for schema mapping and feed health."
    ]),
    Paragraph("What the partner receives", styles["H2Dark"]),
    *bullets([
        "Qualified professional demand directed toward eligible inventory.",
        "Aggregated, non-personal insights on searched brands, categories and price bands.",
        "Controlled product visibility respecting brand, territory and channel restrictions.",
        "A measurable pilot report: catalog coverage, matched demand and outbound interest."
    ]),
    Paragraph("Pilot safeguards", styles["H2Dark"]),
    pilot,
    Spacer(1, 8 * mm),
    Paragraph(
        "The objective is simple: validate commercial value before requesting order automation "
        "or a long-term integration.",
        styles["Callout"]
    ),
    PageBreak(),

    Paragraph("Technical integration", styles["H1Dark"]),
    Paragraph(
        "The connector layer normalizes heterogeneous supplier feeds into one controlled product model. "
        "Each source remains identifiable and can be disabled independently.",
        styles["BodyDark"]
    ),
    Paragraph("Supported delivery methods", styles["H2Dark"]),
    methods,
    Paragraph("Decision model", styles["H2Dark"]),
    *bullets([
        "Full acquisition cost: purchase, shipping, duties, VAT and repair allowance.",
        "Expected resale proceeds after platform and payment fees.",
        "Evidence grade from A to D based on recent comparable sales.",
        "Professional status: Validated, Conditional, Review Required or Rejected.",
        "Maximum offer, break-even resale price, recommended channel and indicative sale horizon."
    ]),
    Paragraph("Data governance", styles["H2Dark"]),
    *bullets([
        "Tenant isolation and source-level access controls.",
        "No credentials in source code; secrets remain outside the repository.",
        "Traceable synchronization logs and source health monitoring.",
        "Partner-specific retention, display and geographic rules can be enforced."
    ]),
    Spacer(1, 7 * mm),
    KeepTogether([
        Paragraph("Next step", styles["H2Dark"]),
        Paragraph(
            "Share a sample feed containing 20-100 products and its field documentation. "
            "Deal Hunter AI will return a mapping report, integration estimate and pilot scope.",
            styles["BodyDark"]
        ),
        Paragraph("<b>Contact:</b> dealhunter680@gmail.com", styles["BodyDark"]),
        Paragraph("<b>Product:</b> https://deal-hunter-ai.vercel.app", styles["BodyDark"]),
    ])
]

doc = SimpleDocTemplate(
    str(PDF), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
    topMargin=22 * mm, bottomMargin=18 * mm,
    title="Deal Hunter AI - B2B Catalog Partnership",
    author="Deal Hunter AI"
)
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(PDF)
