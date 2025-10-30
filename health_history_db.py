"""
Health History Database Module
Provides functions to query and organize patient health history data
"""

import pandas as pd
import json
from datetime import datetime
from typing import Dict, List, Optional


class HealthHistoryDB:
    """Database class for managing patient health history"""
    
    def __init__(self, patients_file="patients.json", 
                 labs_file="patient_labs.csv",
                 meds_file="patient_medications.csv",
                 med_db_file="medications_database.json",
                 ranges_file="test_reference_ranges.json"):
        """Initialize the database with data files"""
        
        # Load JSON files
        with open(patients_file) as f:
            self.patients = json.load(f)["patients"]
        
        with open(med_db_file) as f:
            med_data = json.load(f)
            self.med_db = med_data.get("medications", med_data)
        
        with open(ranges_file) as f:
            self.ranges = json.load(f)
        
        # Load CSV files
        self.labs = pd.read_csv(labs_file)
        self.meds = pd.read_csv(meds_file)
        
        # Clean up lab data
        self.labs.rename(columns={"test_date": "date", "test_value": "value"}, inplace=True)
        self.labs["test_name"] = self.labs["test_name"].str.strip().str.lower()
        self.labs["value"] = pd.to_numeric(self.labs["value"], errors="coerce")
        self.labs["date"] = pd.to_datetime(self.labs["date"])
        
        # Clean up medication data
        self.meds["start_date"] = pd.to_datetime(self.meds["start_date"])
    
    def get_patient_info(self, patient_id: str) -> Dict:
        """Get basic patient information"""
        return self.patients.get(patient_id, {})
    
    def get_patient_medications(self, patient_id: str) -> pd.DataFrame:
        """Get all medications for a patient"""
        patient_meds = self.meds[self.meds["patient_id"] == patient_id].copy()
        
        # Add medication details from database
        med_details = []
        for _, row in patient_meds.iterrows():
            med_name = row["medication_name"]
            details = self.med_db.get(med_name, {})
            
            med_details.append({
                "medication_name": med_name,
                "dosage": row["dose"],  # Changed from "dosage" to "dose"
                "frequency": row["frequency"],
                "start_date": row["start_date"],
                "reason": row["reason"],  # Changed from "purpose" to "reason"
                "purpose": details.get("purpose", row["reason"]),  # Get from DB or use reason
                "side_effects": ", ".join(details.get("common_side_effects", [])),
                "monitoring": ", ".join(details.get("monitoring_required", []))
            })
        
        return pd.DataFrame(med_details).sort_values("start_date", ascending=False) if med_details else pd.DataFrame()
    
    def get_patient_labs(self, patient_id: str) -> pd.DataFrame:
        """Get all lab results for a patient"""
        patient_labs = self.labs[self.labs["patient_id"] == patient_id].copy()
        
        # Add status (normal/high/low) to each lab result
        statuses = []
        for _, row in patient_labs.iterrows():
            test_name = row["test_name"]
            value = row["value"]
            
            # Find matching range
            range_key = next((k for k in self.ranges if k.lower() == test_name), None)
            
            if range_key and not pd.isna(value):
                low = self.ranges[range_key]["low"]
                high = self.ranges[range_key]["high"]
                
                if value < low:
                    status = "LOW ⬇️"
                elif value > high:
                    status = "HIGH ⬆️"
                else:
                    status = "NORMAL ✓"
            else:
                status = "UNKNOWN"
            
            statuses.append(status)
        
        patient_labs["status"] = statuses
        return patient_labs.sort_values("date", ascending=False)
    
    def get_abnormal_labs(self, patient_id: str) -> pd.DataFrame:
        """Get only abnormal lab results"""
        all_labs = self.get_patient_labs(patient_id)
        return all_labs[all_labs["status"].isin(["LOW ⬇️", "HIGH ⬆️"])]
    
    def get_health_timeline(self, patient_id: str) -> List[Dict]:
        """Get chronological timeline of all health events"""
        timeline = []
        
        # Add lab events
        labs = self.get_patient_labs(patient_id)
        for _, row in labs.iterrows():
            timeline.append({
                "date": row["date"],
                "type": "Lab Test",
                "description": f"{row['test_name'].upper()}: {row['value']} {row.get('unit', '')}",
                "status": row["status"]
            })
        
        # Add medication events
        meds = self.get_patient_medications(patient_id)
        for _, row in meds.iterrows():
            timeline.append({
                "date": row["start_date"],
                "type": "Medication Started",
                "description": f"{row['medication_name']} - {row['dosage']} ({row['frequency']})",
                "status": "INFO"
            })
        
        # Sort by date (most recent first)
        timeline.sort(key=lambda x: x["date"], reverse=True)
        return timeline
    
    def get_lab_trends(self, patient_id: str, test_name: str) -> pd.DataFrame:
        """Get trend data for a specific lab test over time"""
        labs = self.get_patient_labs(patient_id)
        test_data = labs[labs["test_name"] == test_name.lower()].copy()
        return test_data.sort_values("date")
    
    def generate_health_summary(self, patient_id: str) -> Dict:
        """Generate comprehensive health summary for a patient"""
        patient = self.get_patient_info(patient_id)
        meds = self.get_patient_medications(patient_id)
        abnormal_labs = self.get_abnormal_labs(patient_id)
        
        summary = {
            "patient_name": patient.get("name", "Unknown"),
            "patient_id": patient_id,
            "age": patient.get("general_info", {}).get("age", "N/A"),
            "gender": patient.get("general_info", {}).get("gender", "N/A"),
            "total_medications": len(meds),
            "active_medications": meds["medication_name"].tolist() if not meds.empty else [],
            "abnormal_lab_count": len(abnormal_labs),
            "abnormal_tests": abnormal_labs["test_name"].unique().tolist() if not abnormal_labs.empty else [],
            "latest_lab_date": self.labs[self.labs["patient_id"] == patient_id]["date"].max(),
            "risk_factors": self._identify_risk_factors(patient_id)
        }
        
        return summary
    
    def _identify_risk_factors(self, patient_id: str) -> List[str]:
        """Identify potential health risk factors based on data"""
        risks = []
        abnormal = self.get_abnormal_labs(patient_id)
        
        # Check for specific risk patterns
        if not abnormal.empty:
            tests = abnormal["test_name"].str.lower().unique()
            
            if any("cholesterol" in t or "ldl" in t for t in tests):
                risks.append("Elevated cholesterol - cardiovascular risk")
            
            if any("glucose" in t or "a1c" in t for t in tests):
                risks.append("Blood sugar abnormality - diabetes risk")
            
            if any("blood pressure" in t or "bp" in t for t in tests):
                risks.append("Blood pressure concerns")
            
            if any("liver" in t or "alt" in t or "ast" in t for t in tests):
                risks.append("Liver function monitoring needed")
            
            if any("kidney" in t or "creatinine" in t for t in tests):
                risks.append("Kidney function monitoring needed")
        
        if not risks:
            risks.append("No significant risk factors identified")
        
        return risks
    
    def get_medication_adherence_info(self, patient_id: str) -> List[Dict]:
        """Get medication information to improve adherence"""
        meds = self.get_patient_medications(patient_id)
        adherence_info = []
        
        for _, row in meds.iterrows():
            med_name = row["medication_name"]
            details = self.med_db.get(med_name, {})
            
            adherence_info.append({
                "medication": med_name,
                "purpose": row["purpose"],
                "dosage": row["dosage"],
                "frequency": row["frequency"],
                "why_important": details.get("purpose", row["reason"]),
                "what_to_watch": row["side_effects"],
                "monitoring_needed": row["monitoring"]
            })
        
        return adherence_info
