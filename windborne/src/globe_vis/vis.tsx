import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// If you already have these helpers in your project, keep the imports.
// Otherwise, you can comment them out and add your own country/station drawing.
import getStarfield from "./getStarfield";
import { getStationsOnce, type StationRecord } from "../utils/stationCache";
import {
  drawThreeGeo,
  drawStationsRich,
  type StationPointsRich,
} from "./threeGeoJSON";

// --- Types -----------------------------------------------------------------

// type StationData = Record<string, [number, number]>; // { id: [lat, lon] }

// type StationPoints = THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> & {
//   userData: { stationIds: string[] };
// };

export type GlobeStationsProps = {
  stationUrl?: string; // e.g. '/geojson/station.json'
  countriesUrl?: string; // e.g. '/geojson/countries.json'
  radius?: number; // globe radius in world units
  className?: string;
  style?: React.CSSProperties;
  onStationClick?: (info: { id: string; name: string; index: number }) => void;
};

// --- Component -------------------------------------------------------------

export default function GlobeStations({
  stationUrl = "/geojson/station.json",
  countriesUrl = "/geojson/countries.json",
  radius = 2,
  className,
  style,
  onStationClick,
}: GlobeStationsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current!;

    // Scene basics
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.3);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 100);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.minDistance = radius + 0.1; // just above surface
    controls.maxDistance = 10;

    // dynamic control speeds: slower when close, faster when far
    function updateControlSpeeds() {
      const d = camera.position.distanceTo(controls.target);
      const t = THREE.MathUtils.smoothstep(
        d,
        controls.minDistance,
        controls.maxDistance
      );
      controls.rotateSpeed = THREE.MathUtils.lerp(0.05, 0.9, t);
      controls.zoomSpeed = THREE.MathUtils.lerp(0.3, 1.0, t);
      controls.dampingFactor = THREE.MathUtils.lerp(0.15, 0.06, t);
    }

    // Wireframe outline of the globe
    const wireGeo = new THREE.SphereGeometry(radius);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });
    const edges = new THREE.EdgesGeometry(wireGeo, 1);
    const line = new THREE.LineSegments(edges, lineMat);
    scene.add(line);

    // Optional starfield + lighting
    try {
      const stars = getStarfield({ numStars: 1000 }) as THREE.Object3D;
      scene.add(stars);
    } catch (e) {
      // getStarfield is optional; ignore if not available
    }

    const light = new THREE.DirectionalLight(0xffffff, 1.25);
    light.position.set(5, 10, 7.5);
    scene.add(light);

    // Invisible sphere used for occlusion testing (ray hits this before back-side points)
    const globeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      })
    );
    scene.add(globeMesh);

    // Countries outlines (uses your helper)
    let countriesObj: THREE.Object3D | null = null;
    fetch(countriesUrl)
      .then((r) => r.json())
      .then((data: any) => {
        try {
          // console.log(data);
          countriesObj = drawThreeGeo({
            json: data,
            radius,
            materialOptions: { color: 0xffffff },
          }) as THREE.Object3D;
          scene.add(countriesObj);
          const { clientWidth: w, clientHeight: h } = container; // your mount div
          (countriesObj.userData as any).setResolution?.(w, h);
        } catch (e) {
          console.warn("drawThreeGeo failed:", e);
        }
      })
      .catch(() => {});

    // Stations (uses your helper)
    let stations: StationPointsRich | null = null;
    let cancelled = false;
    (async () => {
      try {
        const records: StationRecord[] = await getStationsOnce(stationUrl, {
          ttlMs: 6 * 60 * 60 * 1000,
          useETag: true,
        });
        if (cancelled) return;
        stations = drawStationsRich({
          records,
          radius,
          materialOptions: { color: 0x9ce0f7 },
        });
        scene.add(stations);
        console.log(`Loaded ${stations.userData.stations.length} stations`);
      } catch (e) {
        console.error("Failed to load stations:", e);
      }
    })();

    // Tooltip overlay
    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.background = "rgba(0,0,0,0.8)";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "6px 12px";
    tooltip.style.borderRadius = "6px";
    tooltip.style.pointerEvents = "none";
    tooltip.style.display = "none";
    tooltip.style.fontSize = "14px";
    tooltip.style.fontFamily =
      "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    tooltip.style.zIndex = "1000";
    tooltip.style.border = "1px solid #333";
    container.appendChild(tooltip);
    tooltipRef.current = tooltip;

    // Picking state
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const globeCenter = new THREE.Vector3(0, 0, 0);

    function worldPerPixel(
      distance: number,
      cam: THREE.PerspectiveCamera,
      viewportH: number
    ) {
      return (
        (2 * distance * Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5))) /
        viewportH
      );
    }

    const pointPx = 1; // visual size in px
    const pickPx = 1; // hover radius in px

    function updateSizesForZoom() {
      if (!stations) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const dist = camera.position.distanceTo(globeCenter);
      const wpp = worldPerPixel(dist, camera, rect.height);
      stations.material.size = wpp * pointPx; // keep visually tiny
      stations.material.needsUpdate = true;
      raycaster.params.Points.threshold = wpp * pickPx; // keep picking comfy
    }

    function onPointerMove(ev: PointerEvent) {
      if (!stations) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      if (Math.hypot(ev.clientX - downXY.x, ev.clientY - downXY.y) > 5) {
        isDragging = true;
      }

      raycaster.setFromCamera(mouse, camera);

      // Occlusion vs globe
      const globeHits = raycaster.intersectObject(globeMesh, true);
      const nearestGlobe = globeHits.length ? globeHits[0] : null;

      // Points raycast
      const hits = raycaster.intersectObject(stations, false);

      // Hemisphere cull (front-facing only)
      const camFromCenter = camera.position
        .clone()
        .sub(globeCenter)
        .normalize();
      const filtered = hits.filter((hit) => {
        const posAttr = stations!.geometry.getAttribute(
          "position"
        ) as THREE.BufferAttribute;
        const point = new THREE.Vector3().fromBufferAttribute(
          posAttr,
          hit.index!
        );
        stations!.localToWorld(point);
        const pointFromCenter = point.sub(globeCenter).normalize();
        return camFromCenter.dot(pointFromCenter) > 0.0;
      });

      if (filtered.length) {
        filtered.sort((a, b) => a.distance - b.distance);
        const hit = filtered[0];

        // If the globe is in front, ignore the point
        if (nearestGlobe && nearestGlobe.distance + 1e-3 < hit.distance) {
          tooltip.style.display = "none";
          return;
        }

        const idx = hit.index!;
        const rec = stations.userData.stations[idx];

        tooltip.style.display = "block";
        tooltip.textContent = [
          rec.station_id,
          rec.station_name ? `— ${rec.station_name}` : "",
          rec.station_network ? ` (${rec.station_network})` : "",
        ].join("");

        let left = ev.clientX + 15;
        let top = ev.clientY - 30;
        if (left + 150 > window.innerWidth) left = ev.clientX - 160;
        if (top < 0) top = ev.clientY + 15;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        return;
      }

      tooltip.style.display = "none";
    }

    renderer.domElement.addEventListener("pointermove", onPointerMove);

    let downXY = { x: 0, y: 0 },
      isDragging = false;
    function onPointerDown(ev: PointerEvent) {
      downXY = { x: ev.clientX, y: ev.clientY };
      isDragging = false;
    }

    async function onPointerUp(ev: PointerEvent) {
      if (isDragging) return; // treat as orbit, not a click
      if (!stations) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // occlude with globe mesh (you already have this in hover)
      const globeHits = raycaster.intersectObject(globeMesh, true);
      const nearestGlobe = globeHits.length ? globeHits[0] : null;

      // pick a point
      const hits = raycaster.intersectObject(stations, false);
      const camFromCenter = camera.position
        .clone()
        .sub(new THREE.Vector3(0, 0, 0))
        .normalize();
      const filtered = hits.filter((hit) => {
        const posAttr = stations!.geometry.getAttribute(
          "position"
        ) as THREE.BufferAttribute;
        const p = new THREE.Vector3().fromBufferAttribute(posAttr, hit.index!);
        stations!.localToWorld(p);
        const pointFromCenter = p.normalize(); // center at origin
        return camFromCenter.dot(pointFromCenter) > 0.0;
      });
      if (!filtered.length) return;

      filtered.sort((a, b) => a.distance - b.distance);
      const hit = filtered[0];
      if (nearestGlobe && nearestGlobe.distance + 1e-3 < hit.distance) return;

      const idx = hit.index!;
      const id = (stations.userData as any).stationIds
        ? (stations.userData as any).stationIds[idx]
        : (stations.userData as any).stations?.[idx]?.station_id;

      const name = (stations.userData as any).stationIds
        ? (stations.userData as any).stationIds[idx]
        : (stations.userData as any).stations?.[idx]?.station_name;

      // fire the callback
      if (id && onStationClick) onStationClick({ id, name, index: idx });
    }

    // add listeners
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // Resize handling
    function onResize() {
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
      (countriesObj?.userData as any)?.setResolution?.(
        clientWidth,
        clientHeight
      );
    }
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    let rafId = 0;
    function animate() {
      // if (!stations || !countriesObj) return;
      rafId = requestAnimationFrame(animate);
      updateControlSpeeds();
      updateSizesForZoom();
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      tooltip.remove();

      // Dispose
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose?.();
        }
        const mat = (obj as THREE.Mesh).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (mat) {
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
          else mat.dispose?.();
        }
      });

      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [countriesUrl, stationUrl, radius]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
