import sys
import os
import pickle
import numpy as np
import geojson
import requests
try:
    import shap
except Exception:
    shap = None


def run_pipeline(park_id):
    # Metropolitan NCR grid (aligned with existing heatmap demos)
    lat_start = 28.45
    lng_start = 76.85
    lat_end = 28.75
    lng_end = 77.35
    bounds_ncr = {"w": lng_start, "s": lat_start, "e": lng_end, "n": lat_end}

    center_lat = (lat_start + lat_end) / 2.0
    center_lng = (lng_start + lng_end) / 2.0

    ndvi_grid = None
    dem_grid = None
    try:
        from ndviService import get_gee_ndvi_grid, get_gee_dem_grid

        ndvi_grid = get_gee_ndvi_grid(park_id, bounds=bounds_ncr)
        try:
            dem_grid = get_gee_dem_grid(bounds_ncr)
        except Exception as e:
            print(f"DEM fetch failed; using flat fallback. {e}")
            dem_grid = np.full(ndvi_grid.shape, 215.0)
    except Exception as e:
        print(f"GEE/ndviService unavailable; using synthetic raster fallback. {e}")
        rng = np.random.default_rng(42)
        ndvi_grid = rng.uniform(0.2, 0.75, (70, 170))
        dem_grid = rng.uniform(198, 245, ndvi_grid.shape)

    min_lat = min(ndvi_grid.shape[0], dem_grid.shape[0])
    min_lng = min(ndvi_grid.shape[1], dem_grid.shape[1])
    ndvi_grid = ndvi_grid[:min_lat, :min_lng]
    dem_grid = dem_grid[:min_lat, :min_lng]

    grid_size_lat, grid_size_lng = ndvi_grid.shape

    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flood_risk_rf.pkl")
    model = None
    n_features = 5
    try:
        with open(model_path, "rb") as f:
            model = pickle.load(f)
        # Backward compatible with older 4-feature pickles until `python train_model.py` is run
        n_features = int(getattr(model, "n_features_in_", 5) or 5)
        print(f"Loaded RF expects n_features={n_features}")
    except Exception as e:
        print(f"Model load unavailable ({e}); using deterministic heuristic risk function.")

    print("Fetching live weather (rainfall intensity + 72h accumulation) at NCR centroid for model input...")
    try:
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={center_lat}&longitude={center_lng}"
            f"&current=precipitation,relative_humidity_2m"
            f"&daily=precipitation_sum"
            f"&past_days=3"
            f"&forecast_days=1"
        )
        w_res = requests.get(weather_url, timeout=12).json()
        # Open-Meteo: current.precipitation = mm in the last hour (step); use as intensity proxy
        current_rainfall = float(w_res.get("current", {}).get("precipitation") or 0)
        current_humidity = float(w_res.get("current", {}).get("relative_humidity_2m") or 0)
        daily = w_res.get("daily", {}) or {}
        past_precip = daily.get("precipitation_sum") or []
        saturated_load = float(
            round(sum(float(p) for p in past_precip if p is not None), 2)
        )
        print(
            f"[Weather] Rain(intensity proxy)={current_rainfall} mm, Humidity={current_humidity}%, "
            f"72h cumulative precip={saturated_load} mm"
        )
    except Exception as e:
        print(f"Weather fetch failed ({e}); using conservative fallbacks.")
        current_rainfall = 8.0
        current_humidity = 72.0
        saturated_load = 45.0

    lat_step = (lat_end - lat_start) / grid_size_lat
    lng_step = (lng_end - lng_start) / grid_size_lng

    features = []
    cells = []

    for i in range(grid_size_lat):
        for j in range(grid_size_lng):
            ndvi_val = float(ndvi_grid[i, j])
            real_elev = float(dem_grid[i, j])
            cell_lng = lng_start + (j * lng_step)
            # Yamuna corridor proxy (degrees -> meters)
            dist_to_yamuna = abs(float(cell_lng) - 77.25) * 111000.0
            if n_features <= 4:
                features.append([ndvi_val, current_rainfall, dist_to_yamuna, real_elev])
            else:
                features.append(
                    [ndvi_val, current_rainfall, dist_to_yamuna, real_elev, saturated_load]
                )
            cell_lat = lat_start + (i * lat_step)
            cell_lng_0 = lng_start + (j * lng_step)
            cells.append(
                {
                    "i": i,
                    "j": j,
                    "poly": [
                        (cell_lng_0, cell_lat),
                        (cell_lng_0 + lng_step, cell_lat),
                        (cell_lng_0 + lng_step, cell_lat + lat_step),
                        (cell_lng_0, cell_lat + lat_step),
                        (cell_lng_0, cell_lat),
                    ],
                }
            )

    X = np.array(features, dtype=float)
    if model is not None:
        predictions = model.predict(X)
    else:
        # Heuristic fallback if sklearn/model is unavailable in container
        ndvi = X[:, 0]
        rain = X[:, 1]
        water_dist = X[:, 2]
        elev = X[:, 3]
        sat = X[:, 4] if X.shape[1] > 4 else np.full(X.shape[0], saturated_load)
        predictions = (
            (0.82 - ndvi) * 0.18
            + np.clip(rain / 120.0, 0, 1) * 0.28
            + np.clip(sat / 320.0, 0, 1) * 0.24
            + (1.0 - np.minimum(water_dist, 12000.0) / 12000.0) * 0.16
            + (1.0 - np.minimum(elev - 185.0, 90.0) / 90.0) * 0.14
        )
        predictions = np.clip(predictions, 0.0, 1.0)

    print("SHAP feature attributions (best effort)...")
    if shap is None:
        print("SHAP not installed; attributions default to zeros.")
        attributions = np.zeros(X.shape)
    else:
        try:
            explainer = shap.TreeExplainer(model)
            shap_vals = explainer.shap_values(X)
            if isinstance(shap_vals, list):
                shap_impact = np.abs(shap_vals[1]) if len(shap_vals) > 1 else np.abs(shap_vals[0])
            else:
                shap_impact = np.abs(shap_vals)
            shap_sums = np.sum(shap_impact, axis=1)[:, np.newaxis]
            shap_sums[shap_sums == 0] = 1e-9
            attributions = (shap_impact / shap_sums) * 100
        except Exception as e:
            print(f"SHAP calculation failed: {e}")
            attributions = np.zeros(X.shape)

    features_geojson = []

    for idx, cell in enumerate(cells):
        risk_score = float(predictions[idx])

        if risk_score > 0.65:
            color = "#ef4444"
            level = "High"
        elif risk_score > 0.4:
            color = "#eab308"
            level = "Medium"
        else:
            color = "#22c55e"
            level = "Low"

        # Visual extrusion height for Mapbox GL (meters)
        extrusion_m = max(8.0, min(900.0, risk_score * 650.0))

        sat_val = float(X[idx][4]) if X.shape[1] > 4 else saturated_load
        attr_props = {
            "vegetation_ndvi": round(float(attributions[idx][0]), 1),
            "rainfall_intensity": round(float(attributions[idx][1]), 1),
            "water_closeness": round(float(attributions[idx][2]), 1),
            "topography_elevation": round(float(attributions[idx][3]), 1),
        }
        if X.shape[1] > 4:
            attr_props["rainfall_accumulation_72h"] = round(float(attributions[idx][4]), 1)

        feature = geojson.Feature(
            geometry=geojson.Polygon([cell["poly"]]),
            properties={
                "riskScore": round(risk_score, 4),
                "level": level,
                "fillColor": color,
                "fillOpacity": 0.55,
                "extrusionHeight": round(extrusion_m, 1),
                "ndvi": round(float(X[idx][0]), 3),
                "rainfall": round(float(X[idx][1]), 3),
                "humidity": round(current_humidity, 1),
                "elevation": round(float(X[idx][3]), 2),
                "saturatedLoad": round(sat_val, 2),
                "waterProximityM": round(float(X[idx][2]), 1),
                "attributions": attr_props,
            },
        )
        features_geojson.append(feature)

    feature_collection = geojson.FeatureCollection(features_geojson)

    public_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "public", "heatmaps")
    )
    os.makedirs(public_dir, exist_ok=True)

    output_path = os.path.join(public_dir, f"{park_id}_heatmap.geojson")
    with open(output_path, "w") as f:
        geojson.dump(feature_collection, f)

    print(f"Pipeline completed. Heatmap saved to {output_path}")


if __name__ == "__main__":
    pid = sys.argv[1] if len(sys.argv) > 1 else "default_park"
    run_pipeline(pid)
