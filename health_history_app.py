"""
Health History Page for Visual Health Insight App
Add this to your existing Streamlit app or run standalone
Run: streamlit run health_history_app.py
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from health_history_db import HealthHistoryDB

#Bash: streamlit run health_history_app.py
# Initialize database
@st.cache_resource
def init_db():
    return HealthHistoryDB()

db = init_db()

# Page config
st.set_page_config(page_title="Health History", layout="wide")
st.title("📋 Patient Health History & Insights")

# Get list of patients
patients = db.patients
patient_options = {f"{p['name']} ({pid})": pid for pid, p in patients.items()}

# Patient selector
selected = st.selectbox("Select Patient", options=list(patient_options.keys()))
patient_id = patient_options[selected]

# Get patient data
patient_info = db.get_patient_info(patient_id)
summary = db.generate_health_summary(patient_id)

st.divider()

# ======================
# SECTION 1: Patient Overview
# ======================
st.header(f"🧍 {summary['patient_name']}")

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Age", summary['age'])
with col2:
    st.metric("Gender", summary['gender'])
with col3:
    st.metric("Active Medications", summary['total_medications'])
with col4:
    st.metric("Abnormal Tests", summary['abnormal_lab_count'])

st.divider()

# ======================
# SECTION 2: Health Summary & Risk Factors
# ======================
st.header("⚠️ Health Summary & Risk Factors")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Risk Factors")
    for risk in summary['risk_factors']:
        if "No significant" in risk:
            st.success(f"✅ {risk}")
        else:
            st.warning(f"⚠️ {risk}")

with col2:
    st.subheader("Abnormal Tests Detected")
    if summary['abnormal_tests']:
        for test in summary['abnormal_tests']:
            st.error(f"🔴 {test.upper()}")
    else:
        st.success("✅ All tests within normal range")

st.divider()

# ======================
# SECTION 3: Medications
# ======================
st.header("💊 Current Medications")

meds_df = db.get_patient_medications(patient_id)

if not meds_df.empty:
    # Display medications in expandable sections
    for idx, row in meds_df.iterrows():
        with st.expander(f"**{row['medication_name']}** - {row['dosage']}"):
            st.write(f"**Purpose:** {row['purpose']}")
            st.write(f"**Frequency:** {row['frequency']}")
            st.write(f"**Started:** {row['start_date'].strftime('%Y-%m-%d')}")
            st.write(f"**Common Side Effects:** {row['side_effects']}")
            st.write(f"**Monitoring Required:** {row['monitoring']}")
    
    # Medication adherence tips
    st.info("💡 **Medication Adherence Tips**: Take medications at the same time daily, use a pill organizer, set phone reminders, and never stop without consulting your doctor.")
else:
    st.info("No current medications on record.")

st.divider()

# ======================
# SECTION 4: Lab Results
# ======================
st.header("🧪 Lab Results History")

labs_df = db.get_patient_labs(patient_id)

if not labs_df.empty:
    # Filter options
    col1, col2 = st.columns([3, 1])
    with col1:
        show_all = st.checkbox("Show all results", value=True)
    with col2:
        if not show_all:
            st.write("Showing abnormal only")
    
    # Filter data
    display_df = labs_df if show_all else db.get_abnormal_labs(patient_id)
    
    # Display lab results table
    display_cols = ["date", "test_name", "value", "unit", "status"]
    display_table = display_df[display_cols].copy()
    display_table["date"] = display_table["date"].dt.strftime("%Y-%m-%d")
    display_table.columns = ["Date", "Test Name", "Value", "Unit", "Status"]
    
    st.dataframe(display_table, use_container_width=True, height=400)
    
    # Lab trends visualization
    st.subheader("📊 Lab Trends Over Time")
    
    # Get unique tests for this patient
    available_tests = sorted(labs_df["test_name"].unique())
    selected_test = st.selectbox("Select test to visualize", available_tests)
    
    if selected_test:
        trend_data = db.get_lab_trends(patient_id, selected_test)
        
        if not trend_data.empty:
            # Get reference range
            range_key = next((k for k in db.ranges if k.lower() == selected_test), None)
            
            fig = go.Figure()
            
            # Add actual values line
            fig.add_trace(go.Scatter(
                x=trend_data["date"],
                y=trend_data["value"],
                mode='lines+markers',
                name='Actual Value',
                line=dict(color='blue', width=2),
                marker=dict(size=8)
            ))
            
            # Add reference range bands
            if range_key:
                ref_range = db.ranges[range_key]
                fig.add_hline(
                    y=ref_range["high"],
                    line_dash="dash",
                    line_color="red",
                    annotation_text="High Limit"
                )
                fig.add_hline(
                    y=ref_range["low"],
                    line_dash="dash",
                    line_color="red",
                    annotation_text="Low Limit"
                )
                
                # Add normal range shading
                fig.add_hrect(
                    y0=ref_range["low"],
                    y1=ref_range["high"],
                    fillcolor="green",
                    opacity=0.1,
                    line_width=0
                )
            
            fig.update_layout(
                title=f"{selected_test.upper()} Trend",
                xaxis_title="Date",
                yaxis_title=f"Value ({trend_data['unit'].iloc[0]})",
                hovermode='x unified',
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)
else:
    st.info("No lab results on record.")

st.divider()

# ======================
# SECTION 5: Health Timeline
# ======================
st.header("📅 Health Timeline")

timeline = db.get_health_timeline(patient_id)

if timeline:
    # Display timeline
    for event in timeline[:20]:  # Show last 20 events
        date_str = event["date"].strftime("%Y-%m-%d")
        
        if event["type"] == "Lab Test":
            if "HIGH" in event["status"] or "LOW" in event["status"]:
                st.error(f"**{date_str}** - {event['type']}: {event['description']} - {event['status']}")
            else:
                st.success(f"**{date_str}** - {event['type']}: {event['description']} - {event['status']}")
        else:
            st.info(f"**{date_str}** - {event['type']}: {event['description']}")
    
    if len(timeline) > 20:
        st.caption(f"Showing 20 of {len(timeline)} total events")
else:
    st.info("No health events recorded.")

st.divider()

# ======================
# SECTION 6: Comprehensive Report
# ======================
st.header("📄 Comprehensive Health Report")

with st.expander("📥 View/Download Comprehensive Report"):
    st.markdown(f"""
    # Health Report for {summary['patient_name']}
    **Patient ID:** {patient_id}  
    **Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}
    
    ---
    
    ## Patient Information
    - **Age:** {summary['age']}
    - **Gender:** {summary['gender']}
    - **Last Lab Date:** {summary['latest_lab_date'].strftime('%Y-%m-%d') if pd.notna(summary['latest_lab_date']) else 'N/A'}
    
    ## Current Medications ({summary['total_medications']})
    """)
    
    for med in summary['active_medications']:
        st.markdown(f"- {med}")
    
    st.markdown(f"""
    ## Risk Factors & Alerts
    """)
    
    for risk in summary['risk_factors']:
        st.markdown(f"- {risk}")
    
    st.markdown(f"""
    ## Abnormal Test Results ({summary['abnormal_lab_count']})
    """)
    
    if summary['abnormal_tests']:
        for test in summary['abnormal_tests']:
            st.markdown(f"- {test.upper()}")
    else:
        st.markdown("- No abnormal results")
    
    st.markdown("""
    ---
    
    ## Recommendations
    1. Continue taking all prescribed medications as directed
    2. Follow up with healthcare provider for abnormal results
    3. Maintain regular monitoring schedule
    4. Report any new symptoms immediately
    5. Keep all follow-up appointments
    
    **Note:** This report is for informational purposes only. Always consult with your healthcare provider for medical advice.
    """)

st.divider()
st.caption("Visual Health Insight App - Health History Module | Data is for demonstration purposes only")
