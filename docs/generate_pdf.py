"""Generate adding-a-new-customer.pdf — simple onboarding guide."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

OUTPUT = "docs/adding-a-new-customer.pdf"

BRAND  = colors.HexColor("#007aff")
DARK   = colors.HexColor("#001833")
LIGHT  = colors.HexColor("#e6f3ff")
GRAY   = colors.HexColor("#6b7280")
BORDER = colors.HexColor("#d1d5db")

styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, parent=styles["Normal"], **kw)

title_style  = S("T",  fontSize=20, textColor=DARK,  leading=26, spaceAfter=4,  fontName="Helvetica-Bold")
sub_style    = S("Su", fontSize=10, textColor=GRAY,  leading=15, spaceAfter=14)
h1_style     = S("H1", fontSize=12, textColor=BRAND, leading=18, spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
body_style   = S("B",  fontSize=10, textColor=DARK,  leading=15, spaceAfter=5)
bullet_style = S("Bu", fontSize=10, textColor=DARK,  leading=15, spaceAfter=4, leftIndent=14)
code_style   = S("C",  fontSize=9,  textColor=colors.HexColor("#1e3a5f"), leading=13,
                       fontName="Courier", backColor=colors.HexColor("#f3f4f6"),
                       leftIndent=12, rightIndent=12, spaceBefore=3, spaceAfter=3)
note_style   = S("N",  fontSize=9,  textColor=colors.HexColor("#92400e"), leading=13, leftIndent=6)
footer_style = S("F",  fontSize=8,  textColor=GRAY,  leading=12)

def bullet(text):
    return Paragraph(f"&#8226;  {text}", bullet_style)

def step_header(n, label):
    data = [[
        Paragraph(f"Step {n}", S("SN", fontSize=11, textColor=colors.white, fontName="Helvetica-Bold", leading=16)),
        Paragraph(label,       S("SL", fontSize=11, textColor=DARK,         fontName="Helvetica-Bold", leading=16)),
    ]]
    t = Table(data, colWidths=[52, 478])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(0,0), BRAND),
        ("BACKGROUND",   (1,0),(1,0), LIGHT),
        ("VALIGN",       (0,0),(-1,-1), "MIDDLE"),
        ("LEFTPADDING",  (0,0),(-1,-1), 10),
        ("TOPPADDING",   (0,0),(-1,-1), 7),
        ("BOTTOMPADDING",(0,0),(-1,-1), 7),
    ]))
    return t


doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=18*mm, bottomMargin=18*mm,
    title="Adding a New Customer — Eduthing Chromebook EOL",
    author="Eduthing",
)

story = []

# ── Header ────────────────────────────────────────────────────────────────────
hdr = Table([[
    Paragraph("Eduthing", S("HB", fontSize=16, textColor=colors.white, fontName="Helvetica-Bold", leading=20)),
    Paragraph("Chromebook EOL Dashboard", S("HS", fontSize=10, textColor=colors.HexColor("#93c5fd"), leading=14)),
]], colWidths=[160, 370])
hdr.setStyle(TableStyle([
    ("BACKGROUND",   (0,0),(-1,-1), DARK),
    ("VALIGN",       (0,0),(-1,-1), "MIDDLE"),
    ("LEFTPADDING",  (0,0),(-1,-1), 14),
    ("TOPPADDING",   (0,0),(-1,-1), 12),
    ("BOTTOMPADDING",(0,0),(-1,-1), 12),
]))
story.append(hdr)
story.append(Spacer(1, 10))

# ── Title ─────────────────────────────────────────────────────────────────────
story.append(Paragraph("Adding a New Customer", title_style))
story.append(Paragraph("Quick guide for onboarding a school onto the Chromebook EOL Dashboard.", sub_style))
story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

# ── Step 1 ────────────────────────────────────────────────────────────────────
story.append(step_header(1, "Sign In to the Customer's Google Admin Console"))
story.append(Spacer(1, 6))
story.append(bullet("Go to <b>admin.google.com</b> and sign in as a Super Admin for that school"))
story.append(bullet("Navigate to: <b>Security &#8594; Access and data control &#8594; API controls</b>"))
story.append(bullet("Click <b>Manage Domain Wide Delegation</b>"))
story.append(bullet("Click <b>Add new</b> and enter the following:"))
story.append(Spacer(1, 4))

story.append(Paragraph("<b>Client ID:</b>", body_style))
story.append(Paragraph("[Eduthing service account Client ID — ask your manager if unsure]", code_style))
story.append(Spacer(1, 4))

story.append(Paragraph("<b>OAuth Scopes:</b>", body_style))
story.append(Paragraph(
    "https://www.googleapis.com/auth/admin.directory.device.chromeos.readonly,"
    "https://www.googleapis.com/auth/admin.directory.device.chromeos",
    code_style,
))
story.append(Spacer(1, 4))
story.append(bullet("Click <b>Authorise</b>"))
story.append(Spacer(1, 14))

# ── Step 2 ────────────────────────────────────────────────────────────────────
story.append(step_header(2, "Add the Customer in the CBEOL Dashboard"))
story.append(Spacer(1, 6))
story.append(bullet("Open <b>http://cbeol.eduthing.co.uk:8090</b> and sign in"))
story.append(bullet("Click <b>&#9881; Customers</b> in the left sidebar"))
story.append(bullet("Fill in the <b>Add customer</b> form with the following three fields:"))
story.append(Spacer(1, 4))

fields = [
    [Paragraph("<b>Field</b>", body_style),        Paragraph("<b>What to enter</b>", body_style)],
    ["Customer name",                               "The school or organisation name"],
    ["Google Workspace domain",                     "Their domain, e.g. greenfield.org.uk"],
    ["Admin email for DWD",                         "The Super Admin email used in Step 1"],
]
ft = Table(fields, colWidths=[200, 330])
ft.setStyle(TableStyle([
    ("BACKGROUND",    (0,0),(-1,0), BRAND),
    ("TEXTCOLOR",     (0,0),(-1,0), colors.white),
    ("FONTNAME",      (0,0),(-1,0), "Helvetica-Bold"),
    ("FONTSIZE",      (0,0),(-1,-1), 9),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#f9fafb")]),
    ("GRID",          (0,0),(-1,-1), 0.5, BORDER),
    ("LEFTPADDING",   (0,0),(-1,-1), 8),
    ("TOPPADDING",    (0,0),(-1,-1), 5),
    ("BOTTOMPADDING", (0,0),(-1,-1), 5),
]))
story.append(ft)
story.append(Spacer(1, 6))
story.append(Paragraph(
    "&#9432;  Leave all other fields as their defaults and click <b>Add customer</b>.",
    note_style,
))
story.append(Spacer(1, 14))

# ── Step 3 ────────────────────────────────────────────────────────────────────
story.append(step_header(3, "Run the First Sync"))
story.append(Spacer(1, 6))
story.append(bullet("Click the customer name to open their detail page"))
story.append(bullet("Click <b>Sync customer</b> in the top right"))
story.append(bullet("Wait for the status to show <b>success</b> — usually takes under a minute"))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "&#9432;  If the sync fails, double-check the Client ID and scopes were entered correctly in Step 1.",
    note_style,
))

# ── Footer ────────────────────────────────────────────────────────────────────
story.append(Spacer(1, 30))
story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=6))
story.append(Paragraph(
    "Eduthing Internal Use Only  ·  Chromebook EOL Dashboard  ·  May 2026  ·  Made by LS @ EDU",
    footer_style,
))

doc.build(story)
print(f"PDF created: {OUTPUT}")
