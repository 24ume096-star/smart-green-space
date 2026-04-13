import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { FloodZoneLayer } from "./FloodZoneLayer";
import { parkPolygons, parkNdviPoints } from "../data/parkData";

type Props = {
  geojson: GeoJSON.FeatureCollection | null;
  center: [number, number];
  pitch?: number;
  zoom?: number;
  rainfallMm?: number;
  riverLevel?: number;
};

const YAMUNA_CENTERLINE: [number, number][] = [
  [77.235, 28.735],
  [77.238, 28.72],
  [77.245, 28.7],
  [77.248, 28.682],
  [77.258, 28.66],
  [77.27, 28.645],
  [77.28, 28.628],
  [77.29, 28.61],
  [77.292, 28.59],
  [77.291, 28.57],
  [77.286, 28.55],
  [77.28, 28.528],
];

function createYamunaBufferPolygon(
  line: [number, number][],
  bufferMeters: number
): [number, number][][] {
  if (line.length < 2) return [[]];
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const [lng1, lat1] = line[i];
    const [lng2, lat2] = line[i + 1];
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const len = Math.hypot(dLat, dLng) || 1e-9;
    const nLat = -dLng / len;
    const nLng = dLat / len;
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos((lat1 * Math.PI) / 180);
    const offLat = (bufferMeters * nLat) / metersPerDegLat;
    const offLng = (bufferMeters * nLng) / metersPerDegLng;
    left.push([lng1 + offLng, lat1 + offLat]);
    right.push([lng1 - offLng, lat1 - offLat]);
    if (i === line.length - 2) {
      left.push([lng2 + offLng, lat2 + offLat]);
      right.push([lng2 - offLng, lat2 - offLat]);
    }
  }
  const ring = [...left, ...right.reverse(), left[0]];
  return [ring];
}

function addYamunaLayers(map: mapboxgl.Map) {
  if (map.getLayer("yamuna-main")) return;
  const lineSource: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: YAMUNA_CENTERLINE,
        },
      },
    ],
  };
  const bufferSource: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: createYamunaBufferPolygon(YAMUNA_CENTERLINE, 1200),
        },
      },
    ],
  };

  map.addSource("yamuna-line", { type: "geojson", data: lineSource });
  map.addSource("yamuna-buffer", { type: "geojson", data: bufferSource });

  map.addLayer({
    id: "yamuna-floodplain-fill",
    type: "fill",
    source: "yamuna-buffer",
    paint: {
      "fill-color": "#378ADD",
      "fill-opacity": 0.12,
    },
  });

  map.addLayer({
    id: "yamuna-floodplain-outline",
    type: "line",
    source: "yamuna-buffer",
    paint: {
      "line-color": "#378ADD",
      "line-opacity": 0.45,
      "line-width": 2,
      "line-dasharray": [2, 2],
    },
  });

  map.addLayer({
    id: "yamuna-main",
    type: "line",
    source: "yamuna-line",
    paint: {
      "line-color": "#378ADD",
      "line-width": 18,
      "line-opacity": 0.75,
    },
  });
  map.addLayer({
    id: "yamuna-glow",
    type: "line",
    source: "yamuna-line",
    paint: {
      "line-color": "#85B7EB",
      "line-width": 8,
      "line-opacity": 0.5,
    },
  });
  map.addLayer({
    id: "yamuna-label",
    type: "symbol",
    source: "yamuna-line",
    layout: {
      "symbol-placement": "line",
      "text-field": "Yamuna River",
      "text-size": 12,
      "text-letter-spacing": 0.1,
    },
    paint: {
      "text-color": "#85B7EB",
      "text-halo-color": "rgba(0,0,0,0.5)",
      "text-halo-width": 1,
    },
  });
}

function addParkLayers(map: mapboxgl.Map) {
  if (!map.getSource("delhi-parks")) {
    map.addSource("delhi-parks", {
      type: "geojson",
      data: parkPolygons as unknown as GeoJSON.FeatureCollection,
    });
  }
  if (!map.getSource("delhi-park-ndvi-points")) {
    map.addSource("delhi-park-ndvi-points", {
      type: "geojson",
      data: parkNdviPoints as unknown as GeoJSON.FeatureCollection,
    });
  }

  if (!map.getLayer("delhi-park-fill")) {
    map.addLayer({
      id: "delhi-park-fill",
      type: "fill",
      source: "delhi-parks",
      paint: {
        "fill-color": "#1D9E75",
        "fill-opacity": 0.35,
      },
    });
  }
  if (!map.getLayer("delhi-park-outline")) {
    map.addLayer({
      id: "delhi-park-outline",
      type: "line",
      source: "delhi-parks",
      paint: {
        "line-color": "#5DCAA5",
        "line-width": 1.5,
      },
    });
  }

  if (!map.getLayer("delhi-ndvi-heatmap")) {
    map.addLayer({
      id: "delhi-ndvi-heatmap",
      type: "heatmap",
      source: "delhi-park-ndvi-points",
      minzoom: 9,
      maxzoom: 14,
      paint: {
        "heatmap-weight": ["coalesce", ["get", "ndvi"], 0],
        "heatmap-intensity": 1.0,
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9,
          20,
          11,
          30,
          13,
          42,
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,0,0,0)",
          0.3,
          "rgba(151,196,89,0.2)",
          0.6,
          "rgba(29,158,117,0.4)",
          1.0,
          "rgba(8,80,65,0.6)",
        ],
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9,
          1,
          13,
          1,
          14,
          0,
          15,
          0,
        ],
      },
    });
  }
}

function bboxFromFeatureCollection(fc: GeoJSON.FeatureCollection | null): [[number, number], [number, number]] | null {
  if (!fc?.features?.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const f of fc.features) {
    if (f.geometry?.type !== "Polygon") continue;
    const ring = f.geometry.coordinates[0];
    for (const c of ring) {
      const [lng, lat] = c;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function applyRiskLayer(map: mapboxgl.Map, data: GeoJSON.FeatureCollection, listenersBound: { current: boolean }) {
  const src = map.getSource("flood-risk") as mapboxgl.GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
  } else {
    map.addSource("flood-risk", { type: "geojson", data });
    map.addLayer({
      id: "flood-risk-extrusion",
      type: "fill-extrusion",
      source: "flood-risk",
      paint: {
        "fill-extrusion-color": ["coalesce", ["get", "fillColor"], "#22c55e"],
        "fill-extrusion-height": ["coalesce", ["get", "extrusionHeight"], ["*", ["get", "riskScore"], 420]],
        "fill-extrusion-opacity": ["coalesce", ["get", "fillOpacity"], 0.72],
        "fill-extrusion-base": 0,
      },
    });
    map.addLayer({
      id: "flood-risk-outline",
      type: "line",
      source: "flood-risk",
      paint: {
        "line-color": "rgba(255,255,255,0.22)",
        "line-width": 0.35,
      },
    });
  }

  if (!listenersBound.current && map.getLayer("flood-risk-extrusion")) {
    listenersBound.current = true;
    map.on("click", "flood-risk-extrusion", (e) => {
      const feat = e.features?.[0];
      if (!feat?.properties) return;
      const p = feat.properties as Record<string, unknown>;
      const rs = typeof p.riskScore === "number" ? p.riskScore : Number(p.riskScore);
      const pct = Number.isFinite(rs) ? rs * 100 : 0;
      const html = `
          <div style="font-size:12px;color:#0f172a">
            <div style="font-weight:700;margin-bottom:6px">Flood risk cell</div>
            <div>Risk score: <strong>${pct.toFixed(1)}%</strong></div>
            <div>Level: ${String(p.level ?? "")}</div>
            <div>NDVI: ${String(p.ndvi ?? "")}</div>
            <div>Rain (intensity proxy): ${String(p.rainfall ?? "")} mm</div>
            <div>72h precip: ${String(p.saturatedLoad ?? "")} mm</div>
            <div>Water proximity: ${String(p.waterProximityM ?? "")} m</div>
            <div>Elevation: ${String(p.elevation ?? "")} m</div>
          </div>`;
      new mapboxgl.Popup({ offset: 12, maxWidth: "280px" })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });
    map.on("mouseenter", "flood-risk-extrusion", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "flood-risk-extrusion", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  const bb = bboxFromFeatureCollection(data);
  if (bb) {
    map.fitBounds(bb, { padding: 52, duration: 1100, maxZoom: 13.4 });
  }
}

/** Mapbox 3D terrain + extruded risk grid. Requires VITE_MAPBOX_ACCESS_TOKEN. */
export function FloodMapbox3D({
  geojson,
  center,
  pitch = 56,
  zoom = 12.2,
  rainfallMm = 65,
  riverLevel = 30,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const listenersBound = useRef(false);
  const mapLoaded = useRef(false);
  const floodAnimFrameRef = useRef<number | null>(null);
  const floodAnimStartRef = useRef<number>(0);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showNdviHeatmap, setShowNdviHeatmap] = useState(true);

  useEffect(() => {
    if (!token || !containerRef.current) return;

    mapboxgl.accessToken = token;
    listenersBound.current = false;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center,
      zoom,
      pitch,
      bearing: -28,
      antialias: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;
    setMapInstance(map);

    map.on("load", () => {
      mapLoaded.current = true;
      setIsMapLoaded(true);
      try {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.45 });
      } catch (e) {
        console.warn("Terrain source skipped", e);
      }

      try {
        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 75.0],
            "sky-atmosphere-sun-intensity": 14,
          },
        });
      } catch (e) {
        console.warn("Sky layer skipped", e);
      }

      try {
        const layers = map.getStyle().layers || [];
        const beforeId = layers.find((l) => l.type === "symbol")?.id;
        if (beforeId && !map.getLayer("3d-buildings")) {
          map.addLayer(
            {
              id: "3d-buildings",
              source: "composite",
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 13,
              paint: {
                "fill-extrusion-color": "#9ca3af",
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": ["get", "min_height"],
                "fill-extrusion-opacity": 0.35,
              },
            },
            beforeId
          );
        }
      } catch (e) {
        console.warn("3D buildings layer skipped", e);
      }

      try {
        addYamunaLayers(map);
      } catch (e) {
        console.warn("Yamuna layers skipped", e);
      }
      try {
        addParkLayers(map);
      } catch (e) {
        console.warn("Park layers skipped", e);
      }

      // 3-second pulsing floodplain opacity: 0.08 -> 0.22 -> 0.08
      const animateFloodplain = (ts: number) => {
        if (!mapLoaded.current || !map.getLayer("yamuna-floodplain-fill")) return;
        if (floodAnimStartRef.current === 0) floodAnimStartRef.current = ts;
        const elapsed = ts - floodAnimStartRef.current;
        const period = 3000;
        const phase = (elapsed % period) / period;
        const opacity = 0.08 + ((Math.sin(phase * Math.PI * 2) + 1) / 2) * (0.22 - 0.08);
        map.setPaintProperty("yamuna-floodplain-fill", "fill-opacity", opacity);
        floodAnimFrameRef.current = window.requestAnimationFrame(animateFloodplain);
      };
      floodAnimFrameRef.current = window.requestAnimationFrame(animateFloodplain);
    });

    return () => {
      mapLoaded.current = false;
      setIsMapLoaded(false);
      setMapInstance(null);
      if (floodAnimFrameRef.current != null) {
        window.cancelAnimationFrame(floodAnimFrameRef.current);
        floodAnimFrameRef.current = null;
      }
      floodAnimStartRef.current = 0;
      map.remove();
      mapRef.current = null;
      listenersBound.current = false;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson?.features?.length) return;
    const run = () => {
      applyRiskLayer(map, geojson, listenersBound);
    };
    if (map.isStyleLoaded()) run();
    else map.once("load", run);
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom, pitch, essential: true, duration: 800 });
  }, [center, zoom, pitch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("delhi-ndvi-heatmap")) return;
    map.setLayoutProperty("delhi-ndvi-heatmap", "visibility", showNdviHeatmap ? "visible" : "none");
  }, [showNdviHeatmap, isMapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !map.getLayer("delhi-park-fill")) return;

    const hoverPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      maxWidth: "300px",
    });

    const onMove = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: ["delhi-park-fill"] })[0];
      if (!feature || !feature.properties) {
        hoverPopup.remove();
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      const p = feature.properties as Record<string, unknown>;
      const html = `
        <div style="font-size:12px;color:#0f172a;line-height:1.45">
          <div style="font-weight:700;margin-bottom:4px">${String(p.name ?? "Park")}</div>
          <div>Resilience score: <strong>${String(p.resilienceScore ?? "N/A")}</strong></div>
          <div>NDVI reading: <strong>${String(p.ndvi ?? "N/A")}</strong></div>
          <div style="margin-top:4px;color:#334155">Reduces peak runoff by ~28%</div>
        </div>`;
      hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    };

    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      hoverPopup.remove();
    };

    map.on("mousemove", "delhi-park-fill", onMove);
    map.on("mouseleave", "delhi-park-fill", onLeave);
    return () => {
      map.off("mousemove", "delhi-park-fill", onMove);
      map.off("mouseleave", "delhi-park-fill", onLeave);
      hoverPopup.remove();
    };
  }, [isMapLoaded]);

  if (!token) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center text-sm text-white/70">
        <p className="font-semibold text-white">Mapbox token missing</p>
        <p>
          Add{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-accent">VITE_MAPBOX_ACCESS_TOKEN</code> to{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5">apps/frontend/.env</code>, then restart Vite.
        </p>
        <a
          className="text-accent underline"
          href="https://account.mapbox.com/"
          target="_blank"
          rel="noreferrer"
        >
          Get a free Mapbox token
        </a>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="h-full min-h-[420px] w-full" />
      {isMapLoaded ? (
        <div className="pointer-events-auto absolute left-3 top-3 z-[1200] flex items-center gap-2 rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white/85 backdrop-blur">
          <span className="font-medium">NDVI Heatmap</span>
          <button
            type="button"
            onClick={() => setShowNdviHeatmap((v) => !v)}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
              showNdviHeatmap
                ? "bg-accent text-forest"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {showNdviHeatmap ? "On" : "Off"}
          </button>
        </div>
      ) : null}
      <FloodZoneLayer
        map={mapInstance}
        mapLoaded={isMapLoaded}
        rainfallMm={rainfallMm}
        riverLevel={riverLevel}
      />
    </>
  );
}
