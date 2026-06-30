import { useEffect, useMemo, useRef } from "react";
import "./MiniMap.css";

const ORB_COLORS = {
  cyan: "#00eaff",
  green: "#7cff2e",
  orange: "#ff9d00",
  purple: "#a855ff",
  red: "#ff4040",
  pink: "#ff4fc3",
};

const MINIMAP_DRAW_INTERVAL_MS = 83; // 12 FPS: suficient pentru HUD, mult mai ieftin pe mobil.

const CORE_COLORS = {
  nano: "#00eaff",
  rotor: "#ffae3d",
  piercing: "#b45cff",
  overclock: "#ff4040",
  berserk: "#ff7a18",
  "shield-breaker": "#d946ef",
  swarm: "#00ffd5",
  vampire: "#00c46a",
  emp: "#faff00",
};

function getStableOrbKey(orb) {
  return orb?.id || `${Math.round((orb?.x || 0) / 80)}-${Math.round((orb?.y || 0) / 80)}-${orb?.color || "cyan"}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mapPoint(item, worldWidth, worldHeight, w, h, margin = 6) {
  const ww = Math.max(1, Number(worldWidth) || 1);
  const wh = Math.max(1, Number(worldHeight) || 1);

  return {
    x: clamp(((Number(item?.x) || 0) / ww) * w, margin, w - margin),
    y: clamp(((Number(item?.y) || 0) / wh) * h, margin, h - margin),
  };
}

function MiniMap({
  player,
  worldWidth,
  worldHeight,
  orbs = [],
  cores = [],
  safeZoneRadius = null,
  bases = [],
}) {
  const canvasRef = useRef(null);
  const stableOrbsRef = useRef([]);
  const stableCoresRef = useRef([]);
  const basesRef = useRef([]);
  const lastOrbsUpdateRef = useRef(0);

  // Valorile dinamice sunt citite din refs in RAF, fara restartarea buclei.
  const safeZoneRadiusRef = useRef(safeZoneRadius);
  const worldWidthRef = useRef(worldWidth);
  const worldHeightRef = useRef(worldHeight);

  safeZoneRadiusRef.current = safeZoneRadius;
  worldWidthRef.current = worldWidth;
  worldHeightRef.current = worldHeight;
  basesRef.current = Array.isArray(bases)
    ? bases.filter(
        (base) =>
          base &&
          Number.isFinite(Number(base.x)) &&
          Number.isFinite(Number(base.y))
      )
    : [];

  const playerX = clamp(((player?.x || 0) / Math.max(1, worldWidth || 1)) * 100, 0, 100);
  const playerY = clamp(((player?.y || 0) / Math.max(1, worldHeight || 1)) * 100, 0, 100);

  const limitedOrbs = useMemo(() => {
    if (!Array.isArray(orbs)) return [];
    return orbs.slice(0, 520);
  }, [orbs]);

  useEffect(() => {
    const now = performance.now();

    if (!stableOrbsRef.current.length || now - lastOrbsUpdateRef.current > 900) {
      const previousByKey = new Map(
        stableOrbsRef.current.map((orb) => [getStableOrbKey(orb), orb])
      );

      stableOrbsRef.current = limitedOrbs.map((orb) => {
        const key = getStableOrbKey(orb);
        const previous = previousByKey.get(key);

        if (!previous) return orb;

        return {
          ...orb,
          x: previous.x + (orb.x - previous.x) * 0.35,
          y: previous.y + (orb.y - previous.y) * 0.35,
        };
      });

      lastOrbsUpdateRef.current = now;
    }

    stableCoresRef.current = Array.isArray(cores)
      ? cores.filter((core) => !core.pending)
      : [];
  }, [limitedOrbs, cores]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return undefined;

    let frame = 0;
    let lastDrawAt = 0;

    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (now - lastDrawAt < MINIMAP_DRAW_INTERVAL_MS) return;
      lastDrawAt = now;

      const currentSafeZoneRadius = safeZoneRadiusRef.current;
      const currentWorldWidth = worldWidthRef.current;
      const currentWorldHeight = worldHeightRef.current;
      const rect = canvas.getBoundingClientRect();
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const shouldDrawZone =
        Number(currentSafeZoneRadius) > 0 &&
        Number(currentSafeZoneRadius) < Math.min(Number(currentWorldWidth) || 0, Number(currentWorldHeight) || 0) / 2;

      if (shouldDrawZone) {
        const zoneW = clamp(((currentSafeZoneRadius * 2) / Math.max(1, currentWorldWidth || 1)) * w, 0, w - 8);
        const zoneH = clamp(((currentSafeZoneRadius * 2) / Math.max(1, currentWorldHeight || 1)) * h, 0, h - 8);

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, zoneW / 2, zoneH / 2, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(90, 255, 110, 0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      for (const orb of stableOrbsRef.current) {
        const point = mapPoint(orb, currentWorldWidth, currentWorldHeight, w, h, 5);
        const color = ORB_COLORS[orb.color] || ORB_COLORS.cyan;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const core of stableCoresRef.current) {
        const point = mapPoint(core, currentWorldWidth, currentWorldHeight, w, h, 12);
        const color = CORE_COLORS[core.type] || "#00eaff";

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core Heist: baza echipei tale este albastra, baza inamica este rosie.
      // Cerc = perimetrul bazei, diamant = centrul bazei.
      for (const base of basesRef.current) {
        const point = mapPoint(base, currentWorldWidth, currentWorldHeight, w, h, 12);
        const isOwnBase = Boolean(base.isOwnBase);
        const baseColor = isOwnBase ? "#00eaff" : "#ff3d4f";
        const radiusInWorld = Number(base.perimeterRadius || base.radius || 520);
        const scale = Math.min(
          w / Math.max(1, Number(currentWorldWidth) || 1),
          h / Math.max(1, Number(currentWorldHeight) || 1)
        );
        const perimeterRadius = clamp(radiusInWorld * scale, 5, 22);

        ctx.save();

        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, perimeterRadius, 0, Math.PI * 2);
        ctx.fillStyle = isOwnBase
          ? "rgba(0, 234, 255, 0.13)"
          : "rgba(255, 61, 79, 0.13)";
        ctx.fill();

        ctx.strokeStyle = isOwnBase
          ? "rgba(0, 234, 255, 0.92)"
          : "rgba(255, 61, 79, 0.92)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = baseColor;
        ctx.shadowBlur = 12;
        ctx.shadowColor = baseColor;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y - 5.5);
        ctx.lineTo(point.x + 5.5, point.y);
        ctx.lineTo(point.x, point.y + 5.5);
        ctx.lineTo(point.x - 5.5, point.y);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      ctx.globalAlpha = 1;
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="minimap">
      <canvas ref={canvasRef} className="minimap-canvas" />
      <div className="minimap-title">WORLD MAP</div>

      <div className="minimap-map-area">
        <div
          className={`minimap-player-drone minimap-drone-${player?.skin || "cyan"}`}
          style={{
            left: `${playerX}%`,
            top: `${playerY}%`,
          }}
        >
          <div className="mini-drone-arm mini-drone-arm-a" />
          <div className="mini-drone-arm mini-drone-arm-b" />

          <div className="mini-drone-rotor mini-drone-tl" />
          <div className="mini-drone-rotor mini-drone-tr" />
          <div className="mini-drone-rotor mini-drone-bl" />
          <div className="mini-drone-rotor mini-drone-br" />

          <div className="mini-drone-body" />
          <div className="mini-drone-light" />
        </div>
      </div>
    </div>
  );
}

export default MiniMap;
