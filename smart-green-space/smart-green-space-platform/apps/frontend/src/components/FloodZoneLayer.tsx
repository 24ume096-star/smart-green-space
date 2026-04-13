import { useEffect, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import { floodZones } from "../data/floodZones";

type Props = {
  map: mapboxgl.Map | null;
  mapLoaded: boolean;
  rainfallMm: number;
  riverLevel: number;
};

const SOURCE_ID = "delhi-flood-zones";
const LAYER_ID = "delhi-flood-zones-3d";
const OUTLINE_ID = "delhi-flood-zones-outline";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function FloodZoneLayer({ map, mapLoaded, rainfallMm, riverLevel }: Props) {
  const adjustedById = useMemo(() => {
    const entries: Array<{ id: string; adjustedRisk: number }> = [];
    for (const feature of floodZones.features) {
      const baseRisk = Number(feature.properties?.baseRisk ?? feature.properties?.riskScore ?? 0);
      const adjustedRisk = clamp(
        baseRisk + (rainfallMm - 65) * 0.18 + (riverLevel - 30) * 0.22,
        0,
        100
      );
      entries.push({ id: String(feature.id ?? feature.properties?.id), adjustedRisk });
    }
    return entries;
  }, [rainfallMm, riverLevel]);

  useEffect(() => {
    if (!map || !mapLoaded) return;

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: floodZones as unknown as GeoJSON.FeatureCollection,
        promoteId: "id",
      });
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "fill-extrusion",
        source: SOURCE_ID,
        paint: {
          "fill-extrusion-height": [
            "*",
            ["coalesce", ["feature-state", "riskScore"], ["get", "riskScore"]],
            120,
          ],
          "fill-extrusion-base": 0,
          "fill-extrusion-color": [
            "step",
            ["coalesce", ["feature-state", "riskScore"], ["get", "riskScore"]],
            "#97C459",
            40,
            "#FAC775",
            60,
            "#EF9F27",
            80,
            "#E24B4A",
            95,
            "#7a1f1f",
          ],
          "fill-extrusion-opacity": 0.75,
        },
      });
    }

    if (!map.getLayer(OUTLINE_ID)) {
      map.addLayer({
        id: OUTLINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "rgba(255,255,255,0.35)",
          "line-width": 1.2,
        },
      });
    }

    const onClick = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] })[0];
      if (!feature) return;
      const props = feature.properties || {};
      const state = map.getFeatureState({ source: SOURCE_ID, id: feature.id as string });
      const risk = Number(state.riskScore ?? props.riskScore ?? 0).toFixed(1);
      const html = `
        <div style="font-size:12px;color:#0f172a;line-height:1.5">
          <div style="font-weight:700;margin-bottom:4px">${String(props.name ?? "Flood Zone")}</div>
          <div>Risk Score: <strong>${risk}</strong></div>
          <div>Population: <strong>${String(props.population ?? "N/A")}</strong></div>
          <div>Cause: ${String(props.cause ?? "N/A")}</div>
        </div>
      `;
      new mapboxgl.Popup({ offset: 10, closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    };

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", LAYER_ID, onClick);
    map.on("mouseenter", LAYER_ID, onEnter);
    map.on("mouseleave", LAYER_ID, onLeave);

    return () => {
      map.off("click", LAYER_ID, onClick);
      map.off("mouseenter", LAYER_ID, onEnter);
      map.off("mouseleave", LAYER_ID, onLeave);
    };
  }, [map, mapLoaded]);

  useEffect(() => {
    if (!map || !mapLoaded || !map.getSource(SOURCE_ID)) return;
    for (const zone of adjustedById) {
      map.setFeatureState(
        {
          source: SOURCE_ID,
          id: zone.id,
        },
        { riskScore: zone.adjustedRisk }
      );
    }
  }, [map, mapLoaded, adjustedById]);

  return null;
}

