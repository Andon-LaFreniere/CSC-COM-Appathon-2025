# Visual Health Insight App — Diagnostic + Medication Integration
# -----------------------------------------------------
# Run locally:
#   pip install streamlit pandas numpy matplotlib python-dateutil
#   streamlit run visual_health_insight_app.py

from __future__ import annotations
import os, json, base64
import pandas as pd
import streamlit as st
from xml.etree import ElementTree as ET

# -----------------------------------------------------
# Streamlit Setup
# -----------------------------------------------------
st.set_page_config(page_title="Visual Health Insight App", layout="wide")
st.title("🩺 Visual Health Insight App — Diagnostic + Medication Mode")

# -----------------------------------------------------
# Helper Functions
# -----------------------------------------------------
def file_exists(p):
    return os.path.exists(p) and os.path.getsize(p) > 0

def load_json(p):
    return json.load(open(p)) if file_exists(p) else None

def set_fill(el, clr, opacity=1.0):
    """Safely override fill color even if inline styles exist."""
    style = el.attrib.get("style", "")
    if "fill:" in style:
        parts = [s for s in style.split(";") if not s.strip().startswith("fill:")]
        el.set("style", ";".join(parts))
    el.set("fill", clr)
    el.set("fill-opacity", str(opacity))
    el.set("stroke", "#000000")
    el.set("stroke-width", "0.4")

def state(val, lo, hi):
    """Return test status."""
    if val is None or pd.isna(val):
        return "unknown"
    if val < lo:
        return "low"
    if val > hi:
        return "high"
    return "normal"

def highlight_svg(svg_text, affected_systems, med_systems, body_map):
    """Color affected and medicated systems using their default colors."""
    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError:
        st.error("❌ SVG parse error.")
        return svg_text


    for sys_name, meta in body_map.items():
        if sys_name in affected_systems or sys_name in med_systems:
            clr = meta.get("color", "#ef5350")
            opacity = 1.0 if sys_name in affected_systems else 0.4
            for sid in meta.get("svg_ids", []):
                sid_lower = sid.lower()
                for el in root.findall(".//{*}*"):
                    for child in el:
                        if child.tag.endswith("title") and child.text:
                            title_text = child.text.strip().lower()
                            if sid_lower in title_text:
                                for sub in el.findall(".//*"):
                                    if sub.tag.endswith("path"):
                                        set_fill(sub, clr, opacity)
                                if el.tag.endswith("path"):
                                    set_fill(el, clr, opacity)
                    
                                break
    return ET.tostring(root, encoding="unicode")

def render_svg(svg_text, height=600):
    """Display SVG inline."""
    b64 = base64.b64encode(svg_text.encode()).decode()
    st.components.v1.html(
        f'<img src="data:image/svg+xml;base64,{b64}" height="{height}"/>',
        height=height + 40,
    )

# -----------------------------------------------------
# Load Core Data
# -----------------------------------------------------
patients_data = load_json("patients.json")
ranges = load_json("test_reference_ranges.json")
body_map = load_json("body_system_mapping.json")
med_db = load_json("medications_database.json")
if med_db and "medications" in med_db:
    med_db = med_db["medications"]

if not patients_data or "patients" not in patients_data:
    st.error("❌ Missing or invalid patients.json")
    st.stop()

if not ranges or not body_map or not med_db:
    st.error("❌ Missing one of: test_reference_ranges.json, body_system_mapping.json, or medications_database.json")
    st.stop()

patients = patients_data["patients"]
labs = pd.read_csv("patient_labs.csv")
meds = pd.read_csv("patient_medications.csv")

labs.rename(columns={"test_date": "date", "test_value": "value"}, inplace=True)
labs["test_name"] = labs["test_name"].str.strip().str.lower()
labs["value"] = pd.to_numeric(labs["value"], errors="coerce")

male_svg = open("homo_sapiens_male.svg").read() if file_exists("homo_sapiens_male.svg") else ""
female_svg = open("homo_sapiens_female.svg").read() if file_exists("homo_sapiens_female.svg") else ""

if not male_svg and not female_svg:
    st.error("❌ Missing SVG files.")
    st.stop()

# -----------------------------------------------------
# Build Patient Tabs
# -----------------------------------------------------
tab_titles = [f"{p['name']} ({pid})" for pid, p in patients.items()]
tabs = st.tabs(tab_titles)

# -----------------------------------------------------
# Render Each Patient
# -----------------------------------------------------
for (pid, pinfo), tab in zip(patients.items(), tabs):
    with tab:
        st.subheader(f"🧍 {pinfo['name']} ({pid})")
        gi = pinfo["general_info"]
        st.markdown(
            f"**Age:** {gi['age']} | **Gender:** {gi['gender']} | "
            f"**Height:** {gi['height_cm']} cm | **Weight:** {gi['weight_kg']} kg | **BMI:** {gi['bmi']}"
        )
        st.divider()

        # Filter this patient's data
        labs_p = labs[labs["patient_id"] == pid].sort_values("date")
        meds_p = meds[meds["patient_id"] == pid]

        # 1️⃣ Identify affected systems from abnormal labs
        affected_systems = set()
        for sys_name, meta in body_map.items():
            for t in meta.get("tests", []):
                t_lower = t.lower()
                df = labs_p[labs_p["test_name"] == t_lower]
                if df.empty:
                    continue
                val = df["value"].iloc[-1]
                key_match = next((k for k in ranges if k.lower() == t_lower), None)
                if not key_match:
                    continue
                lo, hi = ranges[key_match]["low"], ranges[key_match]["high"]
                s = state(val, lo, hi)
                if s in ["high", "low"]:
                    affected_systems.add(sys_name)

        # 2️⃣ Identify medicated systems from medication monitoring
        med_systems = set()
        for _, mrow in meds_p.iterrows():
            mname = mrow["medication_name"]
            if mname not in med_db:
                continue
            m_info = med_db[mname]
            for monitored in m_info.get("monitoring_required", []):
                monitored_lower = monitored.lower()
                for sys_name, meta in body_map.items():
                    # If a monitored test belongs to this system
                    for t in meta.get("tests", []):
                        if t.lower() in monitored_lower:
                            med_systems.add(sys_name)

        # Remove overlap (labs already cover)
        med_systems -= affected_systems

        # 3️⃣ Show summary
        if affected_systems:
            st.write("⚠️ **Abnormal systems detected:**", ", ".join(sorted(affected_systems)))
        else:
            st.success("✅ No abnormal systems detected.")

        if med_systems:
            st.info("💊 **Systems under medication monitoring:** " + ", ".join(sorted(med_systems)))

        st.divider()

        # 4️⃣ Render SVG
        gender = gi["gender"].lower()
        if gender == "female" and female_svg:
            svg = female_svg
        elif gender == "male" and male_svg:
            svg = male_svg
        else:
            st.warning("⚠️ No SVG available for this gender.")
            continue

        colored_svg = highlight_svg(svg, affected_systems, med_systems, body_map)
        render_svg(colored_svg)

        st.caption("Solid = abnormal system; translucent = monitored by medication.")
