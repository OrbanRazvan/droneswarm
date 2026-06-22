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

function getStableEnergyKey(cell) {
  return cell?.id || `energy-${Math.round((cell?.x || 0) / 80)}-${Math.round((cell?.y || 0) / 80)}`;
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
}) {
  const canvasRef = useRef(null);
  const stableOrbsRef = useRef([]);
  const stableCoresRef = useRef([]);
  const lastOrbsUpdateRef = useRef(0);

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
        const prev = previousByKey.get(key);

        if (!prev) return orb;

        return {
          ...orb,
          x: prev.x + (orb.x - prev.x) * 0.35,
          y: prev.y + (orb.y - prev.y) * 0.35,
        };
      });

      lastOrbsUpdateRef.current = now;
    }

    stableCoresRef.current = Array.isArray(cores) ? cores.filter((core) => !core.pending) : [];
  }, [limitedOrbs, cores]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;

      // Battle Royale zone se deseneaza DOAR cand raza este mai mica decat lumea.
      // Normal PvP trimite safeZoneRadius={null}, deci nu apare cerc/linie verde.
      const shouldDrawZone =
        Number(safeZoneRadius) > 0 &&
        Number(safeZoneRadius) < Math.min(Number(worldWidth) || 0, Number(worldHeight) || 0) / 2;

      if (shouldDrawZone) {
        const zoneW = clamp(((safeZoneRadius * 2) / Math.max(1, worldWidth || 1)) * w, 0, w - 8);
        const zoneH = clamp(((safeZoneRadius * 2) / Math.max(1, worldHeight || 1)) * h, 0, h - 8);

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, zoneW / 2, zoneH / 2, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(90, 255, 110, 0.9)";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(70, 255, 100, 0.75)";
        ctx.stroke();
        ctx.restore();
      }

      for (const orb of stableOrbsRef.current) {
        const point = mapPoint(orb, worldWidth, worldHeight, w, h, 5);
        const color = ORB_COLORS[orb.color] || ORB_COLORS.cyan;

        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        ctx.globalAlpha = 0.9;
        ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const core of stableCoresRef.current) {
        const point = mapPoint(core, worldWidth, worldHeight, w, h, 12);
        const color = CORE_COLORS[core.type] || "#00eaff";
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
        ctx.globalAlpha = 0.95;
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.32;
        ctx.arc(point.x, point.y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [worldWidth, worldHeight, safeZoneRadius]);

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
