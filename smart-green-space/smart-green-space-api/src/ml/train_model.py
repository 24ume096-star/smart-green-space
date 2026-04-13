import numpy as np
import pickle
from sklearn.ensemble import RandomForestRegressor
import os


def train():
    """
    Train flood risk regressor on synthetic NCR-like supervision.
    Features (5): [NDVI, rainfall_intensity_mm, distance_to_primary_water_m, elevation_m, precip_cumulative_72h_mm]
    - NDVI: canopy density (lower -> more runoff potential)
    - Rainfall intensity: short-term rate (Open-Meteo precipitation mm in current step, scaled in pipeline)
    - Distance: closeness to main channel / floodplain axis (Yamuna corridor proxy in pipeline)
    - Elevation: SRTM / DEM
    - 72h accumulation: antecedent wetness / soil saturation proxy
    """
    print("Generating simulated training dataset (NDVI, rain, water proximity, elevation, 72h precip)...")
    np.random.seed(42)
    n_samples = 8000

    ndvi = np.random.uniform(0.1, 0.85, n_samples)
    rainfall = np.random.uniform(0, 120, n_samples)  # mm equivalent cell intensity
    distance = np.random.uniform(0, 28000, n_samples)
    elevation = np.random.uniform(188, 275, n_samples)
    precip_72h = np.random.uniform(0, 320, n_samples)

    X = np.column_stack((ndvi, rainfall, distance, elevation, precip_72h))

    # Physics-inspired composite: higher risk when wet + intense rain + near water + low land + low NDVI
    risk = (
        (0.82 - ndvi) * 0.18
        + (rainfall / 120.0) * 0.28
        + (precip_72h / 320.0) * 0.24
        + (1.0 - np.minimum(distance, 12000) / 12000.0) * 0.16
        + (1.0 - np.minimum(elevation - 185, 90) / 90.0) * 0.14
    )
    risk += np.random.normal(0, 0.045, n_samples)
    y = np.clip(risk, 0.0, 1.0)

    print("Training RandomForestRegressor...")
    rf = RandomForestRegressor(n_estimators=80, max_depth=12, min_samples_leaf=4, random_state=42, n_jobs=-1)
    rf.fit(X, y)

    print("Model R^2 (in-sample):", rf.score(X, y))

    path = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(path, "flood_risk_rf.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(rf, f)
    print(f"Saved model to {model_path}")


if __name__ == "__main__":
    train()
