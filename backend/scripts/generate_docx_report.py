import json
import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def create_report():
    doc = Document()

    # Set page margins (0.75 in)
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    PRIMARY_COLOR = RGBColor(26, 54, 93)     # Deep Navy #1A365D
    SECONDARY_COLOR = RGBColor(43, 108, 176) # Accent Blue #2B6CB0
    HIGHLIGHT_COLOR = RGBColor(180, 83, 9)   # Amber / Dark Gold
    HEADER_BG = "1A365D"
    ROW_ALT_BG = "F7FAFC"

    # Header / Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_after = Pt(2)
    run_title = p_title.add_run("ICAIDIET'26 — CONFERENCE DATABASE & FINANCIAL REPORT")
    run_title.font.name = "Arial"
    run_title.font.size = Pt(17)
    run_title.font.bold = True
    run_title.font.color.rgb = PRIMARY_COLOR

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(12)
    run_sub = p_sub.add_run("Executive Status & Revenue Briefing for the Principal / Director | SNS College of Technology")
    run_sub.font.name = "Arial"
    run_sub.font.size = Pt(10)
    run_sub.font.italic = True
    run_sub.font.color.rgb = SECONDARY_COLOR

    # Meta Callout Box
    meta_p = doc.add_paragraph()
    meta_p.paragraph_format.space_after = Pt(12)
    r1 = meta_p.add_run("Database Source: ")
    r1.bold = True
    meta_p.add_run("Cloudflare D1 Production (`icaidiet_text_records`)   |   ")
    r2 = meta_p.add_run("Report Date: ")
    r2.bold = True
    meta_p.add_run("October 16, 2026   |   ")
    r3 = meta_p.add_run("Early Bird Cutoff: ")
    r3.bold = True
    r3_val = meta_p.add_run("October 13, 2026 (Expired)")
    r3_val.font.color.rgb = HIGHLIGHT_COLOR
    r3_val.bold = True

    # 1. Executive Summary Table
    h1 = doc.add_heading(level=1)
    r_h1 = h1.add_run("1. Executive Summary")
    r_h1.font.name = "Arial"
    r_h1.font.size = Pt(12.5)
    r_h1.font.color.rgb = PRIMARY_COLOR

    exec_summary_data = [
        ("Total Manuscripts in Database", "505", "442 active submissions + 63 soft-deleted/withdrawn entries"),
        ("Active Submissions", "442", "Manuscripts actively moving through peer review & registration"),
        ("Accepted Papers (Cleared for Reg.)", "339 (76.7%)", "Approved by Technical Program Committee"),
        ("Papers Under Active Review", "102 (23.1%)", "Peer reviews currently in evaluation phase"),
        ("New Submissions", "1 (0.2%)", "Awaiting reviewer assignment"),
        ("Registration Payments Approved", "157", "46.3% of accepted papers have completed registration"),
        ("Total Realized Revenue (Paid so far)", "₹15,67,000 INR", "Directly credited to conference bank account"),
        ("Early Bird Cutoff Date", "13 Oct 2026", "155 of 157 paid papers registered before this date at ₹10,000"),
        ("Active Registration Fee (Late / Standard)", "₹12,000 INR", "Applies to all registrations post-Oct 13 (+₹2,000 late fee)"),
        ("Projected Revenue from 182 Pending Accepted", "₹21,84,000 INR", "Calculated at standard late rate (₹12k); +₹3.64L late fee upside"),
        ("Total Projected Revenue (Current Accepted)", "₹37,51,000 INR", "₹15.67L realized + ₹21.84L pending accepted"),
        ("Domestic Entries (India)", "441 (99.8%)", "Spread across 8 Indian States & Delhi NCR"),
        ("Foreign Entries", "1 (0.2%)", "Lincoln Univ. College, Malaysia & Nigeria (with VMRF Chennai)"),
        ("Top State by Submissions", "Tamil Nadu (404)", "91.4% of total submissions; 141 paid registrations"),
        ("Top College by Submissions", "KIT Coimbatore (87)", "Followed by Kongu Engg (50) and SKCET (46)"),
        ("Top College by Paid Registrations", "Kongu Engg (21)", "Followed by SKCET (17), KIT (12), SKCT (12)")
    ]

    table1 = doc.add_table(rows=len(exec_summary_data) + 1, cols=3)
    table1.alignment = WD_TABLE_ALIGNMENT.CENTER
    table1.autofit = False
    headers1 = ["Key Parameter", "Value", "Operational Details / Notes"]
    col_widths1 = [Inches(2.5), Inches(1.5), Inches(3.0)]

    hdr_cells1 = table1.rows[0].cells
    for i, title in enumerate(headers1):
        hdr_cells1[i].text = title
        set_cell_background(hdr_cells1[i], HEADER_BG)
        set_cell_margins(hdr_cells1[i], top=100, bottom=100, left=120, right=120)
        p = hdr_cells1[i].paragraphs[0]
        p.runs[0].font.name = "Arial"
        p.runs[0].font.size = Pt(9.5)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)

    for row_idx, row_data in enumerate(exec_summary_data):
        cells = table1.rows[row_idx + 1].cells
        for col_idx, text in enumerate(row_data):
            cells[col_idx].text = text
            if row_idx % 2 == 1:
                set_cell_background(cells[col_idx], ROW_ALT_BG)
            set_cell_margins(cells[col_idx], top=70, bottom=70, left=100, right=100)
            p = cells[col_idx].paragraphs[0]
            if len(p.runs) > 0:
                p.runs[0].font.name = "Arial"
                p.runs[0].font.size = Pt(8.5)
                if col_idx == 1:
                    p.runs[0].font.bold = True
                    p.runs[0].font.color.rgb = PRIMARY_COLOR

    for row in table1.rows:
        for idx, width in enumerate(col_widths1):
            row.cells[idx].width = width

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 2. Early Bird vs Late Fee Structure
    h2 = doc.add_heading(level=1)
    r_h2 = h2.add_run("2. Registration Fee Matrix: Early Bird vs. Standard / Late Fee")
    r_h2.font.name = "Arial"
    r_h2.font.size = Pt(12.5)
    r_h2.font.color.rgb = PRIMARY_COLOR

    doc.add_paragraph(
        "Per the portal registration settings (`registration_config`), the Early Bird registration deadline "
        "was October 13, 2026. Because today is October 16, 2026, all authors registering from this point "
        "forward are charged the Standard / Late Registration Fee."
    )

    fee_structure_data = [
        ("Indian Author — Conf. with Scopus Proceedings", "₹10,000", "₹12,000", "+₹2,000 (+20%)", "Active rate for remaining 182 accepted"),
        ("Indian Author — Conference Alone", "₹2,000", "₹2,500", "+₹500 (+25%)", "Presentation without Scopus indexing"),
        ("Industry Delegate / Research Scholar (Scopus)", "₹12,000", "₹13,000", "+₹1,000 (+8.3%)", "Corporate & sponsored research scholars"),
        ("Industry Delegate — Conference Alone", "₹2,500", "₹3,000", "+₹500 (+20%)", "Industry presentation only"),
        ("Foreign Author — Conf. with Scopus", "$400 USD", "$500 USD", "+$100 USD (+25%)", "International participants (Scopus)"),
        ("Foreign Author — Conference Alone", "$350 USD", "$400 USD", "+$50 USD (+14.3%)", "International presentation only")
    ]

    table_fees = doc.add_table(rows=len(fee_structure_data) + 1, cols=5)
    table_fees.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_fees.autofit = False
    headers_fees = ["Author / Registration Category", "Early Bird (Until Oct 13)", "Standard / Late Fee", "Late Difference", "Application"]
    col_widths_fees = [Inches(2.5), Inches(1.1), Inches(1.1), Inches(1.0), Inches(1.3)]

    hdr_cells_fees = table_fees.rows[0].cells
    for i, title in enumerate(headers_fees):
        hdr_cells_fees[i].text = title
        set_cell_background(hdr_cells_fees[i], HEADER_BG)
        set_cell_margins(hdr_cells_fees[i], top=100, bottom=100, left=100, right=100)
        p = hdr_cells_fees[i].paragraphs[0]
        p.runs[0].font.name = "Arial"
        p.runs[0].font.size = Pt(9)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)

    for row_idx, row_data in enumerate(fee_structure_data):
        cells = table_fees.rows[row_idx + 1].cells
        for col_idx, text in enumerate(row_data):
            cells[col_idx].text = text
            if row_idx % 2 == 1:
                set_cell_background(cells[col_idx], ROW_ALT_BG)
            set_cell_margins(cells[col_idx], top=70, bottom=70, left=100, right=100)
            p = cells[col_idx].paragraphs[0]
            if len(p.runs) > 0:
                p.runs[0].font.name = "Arial"
                p.runs[0].font.size = Pt(8.5)
                if col_idx in [1, 2]:
                    p.runs[0].font.bold = True
                if col_idx == 3:
                    p.runs[0].font.color.rgb = HIGHLIGHT_COLOR
                    p.runs[0].font.bold = True

    for row in table_fees.rows:
        for idx, width in enumerate(col_widths_fees):
            row.cells[idx].width = width

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 3. Realized Revenue vs Projected Late Fee Revenue
    h3 = doc.add_heading(level=1)
    r_h3 = h3.add_run("3. Revenue Realized to Date & Late Fee Projections")
    r_h3.font.name = "Arial"
    r_h3.font.size = Pt(12.5)
    r_h3.font.color.rgb = PRIMARY_COLOR

    p_rev = doc.add_paragraph()
    p_rev.add_run("A. Realized Collections (Completed to Date): ").bold = True
    p_rev.add_run(
        "A total of ₹15,67,000 INR has been verified and deposited. "
        "155 out of 157 payments were completed prior to the Oct 13 cutoff at Early Bird rates:\n"
        "• 149 Indian Author (Early Scopus @ ₹10,000) = ₹14,90,000\n"
        "• 2 Indian Author (Early Conf Alone @ ₹2,000) = ₹4,000\n"
        "• 5 Industry / Research Scholar (Early Scopus @ ₹12,000) = ₹60,000\n"
        "• 1 Industry / Research Scholar (Standard Scopus @ ₹13,000) = ₹13,000\n"
        "Total Realized = ₹15,67,000 INR."
    )

    p_proj = doc.add_paragraph()
    p_proj.add_run("B. Late Fee Financial Projection for 182 Pending Accepted Papers: ").bold = True
    p_proj.add_run(
        "There are 182 accepted papers cleared for registration that have not yet paid. "
        "The comparative financial impact between Early Bird and Standard / Late Fee is outlined below:"
    )

    proj_data = [
        ("Current Realized Revenue (157 Paid Papers)", "₹15,67,000", "₹15,67,000", "Already collected & verified in bank"),
        ("182 Pending Accepted Papers (If paid @ ₹10,000 Early)", "₹18,20,000", "—", "Base early bird projection"),
        ("182 Pending Accepted Papers (Under Active Late Fee @ ₹12,000)", "—", "₹21,84,000", "+₹3,64,000 incremental late fee gain"),
        ("TOTAL REVENUE (Realized + 182 Accepted Papers)", "₹33,87,000", "₹37,51,000", "Net conference revenue from accepted cohort"),
        ("Pipeline: 102 Papers Under Review (Assuming 75% Accepted = 76)", "₹7,60,000", "₹9,12,000", "+₹1,52,000 late fee gain on new accepts"),
        ("POTENTIAL TOTAL GROSS REVENUE", "₹41,47,000", "₹46,63,000", "+₹5,16,000 Total Late Fee Upside Potential")
    ]

    table_proj = doc.add_table(rows=len(proj_data) + 1, cols=4)
    table_proj.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_proj.autofit = False
    headers_proj = ["Pipeline Stage / Cohort", "At Early Bird Rates", "At Standard / Late Rates", "Financial Impact / Notes"]
    col_widths_proj = [Inches(2.8), Inches(1.3), Inches(1.3), Inches(1.6)]

    hdr_cells_proj = table_proj.rows[0].cells
    for i, title in enumerate(headers_proj):
        hdr_cells_proj[i].text = title
        set_cell_background(hdr_cells_proj[i], HEADER_BG)
        set_cell_margins(hdr_cells_proj[i], top=100, bottom=100, left=100, right=100)
        p = hdr_cells_proj[i].paragraphs[0]
        p.runs[0].font.name = "Arial"
        p.runs[0].font.size = Pt(9)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)

    for row_idx, row_data in enumerate(proj_data):
        cells = table_proj.rows[row_idx + 1].cells
        is_highlight = row_idx in [3, 5]
        for col_idx, text in enumerate(row_data):
            cells[col_idx].text = text
            if is_highlight:
                set_cell_background(cells[col_idx], "E2E8F0")
            elif row_idx % 2 == 1:
                set_cell_background(cells[col_idx], ROW_ALT_BG)
            set_cell_margins(cells[col_idx], top=70, bottom=70, left=100, right=100)
            p = cells[col_idx].paragraphs[0]
            if len(p.runs) > 0:
                p.runs[0].font.name = "Arial"
                p.runs[0].font.size = Pt(8.5)
                if is_highlight or col_idx in [1, 2]:
                    p.runs[0].font.bold = True
                if col_idx == 2 and is_highlight:
                    p.runs[0].font.color.rgb = PRIMARY_COLOR

    for row in table_proj.rows:
        for idx, width in enumerate(col_widths_proj):
            row.cells[idx].width = width

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 4. State-Wise Submission & Registration Breakdown
    h4 = doc.add_heading(level=1)
    r_h4 = h4.add_run("4. State-Wise Distribution (Submissions & Registrations)")
    r_h4.font.name = "Arial"
    r_h4.font.size = Pt(12.5)
    r_h4.font.color.rgb = PRIMARY_COLOR

    state_data = [
        ("1", "Tamil Nadu", "404", "91.4%", "141", "53"),
        ("2", "Maharashtra", "11", "2.5%", "0", "2"),
        ("3", "Karnataka", "11", "2.5%", "9", "9"),
        ("4", "Andhra Pradesh", "5", "1.1%", "2", "5"),
        ("5", "Telangana", "4", "0.9%", "3", "1"),
        ("6", "Kerala", "3", "0.7%", "2", "3"),
        ("7", "Uttar Pradesh", "1", "0.2%", "0", "1"),
        ("8", "Gujarat", "1", "0.2%", "0", "1"),
        ("9", "Delhi (NCR)", "1", "0.2%", "0", "1"),
        ("10", "International (Malaysia/Nigeria)", "1", "0.2%", "0", "1"),
        ("—", "TOTAL", "442", "100%", "157", "77+")
    ]

    table3 = doc.add_table(rows=len(state_data) + 1, cols=6)
    table3.alignment = WD_TABLE_ALIGNMENT.CENTER
    table3.autofit = False
    headers3 = ["Rank", "State / Union Territory", "Submissions", "% Share", "Paid Papers", "Colleges"]
    col_widths3 = [Inches(0.6), Inches(2.3), Inches(1.0), Inches(0.9), Inches(1.1), Inches(1.1)]

    hdr_cells3 = table3.rows[0].cells
    for i, title in enumerate(headers3):
        hdr_cells3[i].text = title
        set_cell_background(hdr_cells3[i], HEADER_BG)
        set_cell_margins(hdr_cells3[i], top=100, bottom=100, left=100, right=100)
        p = hdr_cells3[i].paragraphs[0]
        p.runs[0].font.name = "Arial"
        p.runs[0].font.size = Pt(9.5)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)

    for row_idx, row_data in enumerate(state_data):
        cells = table3.rows[row_idx + 1].cells
        for col_idx, text in enumerate(row_data):
            cells[col_idx].text = text
            is_last = (row_idx == len(state_data) - 1)
            if is_last:
                set_cell_background(cells[col_idx], "E2E8F0")
            elif row_idx % 2 == 1:
                set_cell_background(cells[col_idx], ROW_ALT_BG)
            set_cell_margins(cells[col_idx], top=70, bottom=70, left=100, right=100)
            p = cells[col_idx].paragraphs[0]
            if len(p.runs) > 0:
                p.runs[0].font.name = "Arial"
                p.runs[0].font.size = Pt(8.5)
                if is_last or col_idx in [1, 2, 4]:
                    p.runs[0].font.bold = True

    for row in table3.rows:
        for idx, width in enumerate(col_widths3):
            row.cells[idx].width = width

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 5. Top Colleges Table
    h5 = doc.add_heading(level=1)
    r_h5 = h5.add_run("5. Top Participating Colleges (Submissions & Registrations)")
    r_h5.font.name = "Arial"
    r_h5.font.size = Pt(12.5)
    r_h5.font.color.rgb = PRIMARY_COLOR

    top_colleges = [
        ("1", "KIT - Kalaignarkarunanidhi Institute of Technology", "Coimbatore, TN", "87", "12", "13.8%"),
        ("2", "Kongu Engineering College", "Perundurai, TN", "50", "21", "42.0%"),
        ("3", "Sri Krishna College of Engg. & Technology (SKCET)", "Coimbatore, TN", "46", "17", "37.0%"),
        ("4", "Sri Krishna College of Technology (SKCT)", "Coimbatore, TN", "32", "12", "37.5%"),
        ("5", "SNS College of Technology (Host Institution)", "Coimbatore, TN", "24", "10", "41.7%"),
        ("6", "Dr. N.G.P. Institute of Technology", "Coimbatore, TN", "18", "1", "5.6%"),
        ("7", "Panimalar Engineering College", "Chennai, TN", "16", "2", "12.5%"),
        ("8", "KPR Institute of Engineering and Technology", "Coimbatore, TN", "16", "11", "68.8%"),
        ("9", "Sanjivani College of Engineering", "Kopargaon, MH", "10", "0", "0.0%"),
        ("10", "Chennai Institute of Technology", "Chennai, TN", "9", "6", "66.7%"),
        ("11", "Saveetha Engineering College / SIMATS", "Chennai, TN", "8", "1", "12.5%"),
        ("12", "SNS College of Engineering", "Coimbatore, TN", "7", "4", "57.1%"),
        ("13", "SRM Institute of Science and Technology (SRMIST)", "Chennai/Trichy, TN", "6", "4", "66.7%"),
        ("14", "Sri Eshwar College of Engineering", "Coimbatore, TN", "6", "5", "83.3%"),
        ("15", "Adithya Institute of Technology", "Coimbatore, TN", "5", "5", "100.0%"),
        ("16", "Nandha College of Technology / Engineering", "Erode, TN", "5", "3", "60.0%"),
        ("17", "Sri Ramakrishna Engineering College", "Coimbatore, TN", "5", "3", "60.0%"),
        ("18", "St. Joseph's College of Engineering", "Chennai, TN", "5", "0", "0.0%"),
        ("19", "B V Raju Institute of Technology (BVRIT)", "Hyderabad, TS", "4", "3", "75.0%"),
        ("20", "Dr. Mahalingam College of Engineering and Technology", "Pollachi, TN", "4", "3", "75.0%")
    ]

    table4 = doc.add_table(rows=len(top_colleges) + 1, cols=6)
    table4.alignment = WD_TABLE_ALIGNMENT.CENTER
    table4.autofit = False
    headers4 = ["Rank", "College / Institution Name", "City, State", "Submissions", "Paid Papers", "Conversion"]
    col_widths4 = [Inches(0.5), Inches(2.9), Inches(1.3), Inches(0.8), Inches(0.8), Inches(0.7)]

    hdr_cells4 = table4.rows[0].cells
    for i, title in enumerate(headers4):
        hdr_cells4[i].text = title
        set_cell_background(hdr_cells4[i], HEADER_BG)
        set_cell_margins(hdr_cells4[i], top=100, bottom=100, left=100, right=100)
        p = hdr_cells4[i].paragraphs[0]
        p.runs[0].font.name = "Arial"
        p.runs[0].font.size = Pt(9)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(255, 255, 255)

    for row_idx, row_data in enumerate(top_colleges):
        cells = table4.rows[row_idx + 1].cells
        for col_idx, text in enumerate(row_data):
            cells[col_idx].text = text
            if row_idx % 2 == 1:
                set_cell_background(cells[col_idx], ROW_ALT_BG)
            set_cell_margins(cells[col_idx], top=70, bottom=70, left=90, right=90)
            p = cells[col_idx].paragraphs[0]
            if len(p.runs) > 0:
                p.runs[0].font.name = "Arial"
                p.runs[0].font.size = Pt(8.5)
                if col_idx in [1, 3, 4]:
                    p.runs[0].font.bold = True

    for row in table4.rows:
        for idx, width in enumerate(col_widths4):
            row.cells[idx].width = width

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # 6. Strategic Recommendations
    h6 = doc.add_heading(level=1)
    r_h6 = h6.add_run("6. Strategic Recommendations for Management")
    r_h6.font.name = "Arial"
    r_h6.font.size = Pt(12.5)
    r_h6.font.color.rgb = PRIMARY_COLOR

    recs = [
        ("Leverage Late Fee Policy (₹2,000 / paper increment):", 
         "Since the Oct 13 Early Bird deadline has lapsed, each registration brings in ₹12,000 instead of ₹10,000. Converting the 182 pending accepted papers at this rate delivers ₹21.84 Lakhs (+₹3.64 Lakhs late fee increment). Management can also consider offering a short 'Grace Period' at ₹10,000 to trigger a massive payment rush."),
        ("Target Large Pipelines with Group Concessions:",
         "KIT Coimbatore (75 unpaid papers), Dr. N.G.P. IT (17 unpaid papers), Panimalar (14 unpaid papers), and Sanjivani College MH (10 unpaid papers) represent over 115 unpaid accepted papers. Institutional coordination directly with their HoDs/Principals can convert these in bulk."),
        ("Expedite Review of 102 Pending Papers:",
         "There are 102 manuscripts undergoing review. Promptly publishing decisions will inject ~75 additional candidates into the late fee registration pipeline, adding another ₹9+ Lakhs in gross revenue.")
    ]

    for title, desc in recs:
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(4)
        run_bold = p.add_run(title + " ")
        run_bold.bold = True
        run_bold.font.color.rgb = PRIMARY_COLOR
        p.add_run(desc)

    out_path = r"c:\Users\user\3D Objects\conference-portal\ICAIDIET_26_CONFERENCE_REPORT_FOR_PRINCIPAL.docx"
    doc.save(out_path)
    print(f"Document created successfully at: {out_path}")

if __name__ == "__main__":
    create_report()
