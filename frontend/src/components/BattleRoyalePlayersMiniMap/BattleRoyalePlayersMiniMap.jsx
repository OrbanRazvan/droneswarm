import { useEffect, useMemo, useRef } from "react";
import "./BattleRoyalePlayersMiniMap.css";

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

function getStableOrbKey(orb) {
  return orb?.id || `${Math.round((orb?.x || 0) / 80)}-${Math.round((orb?.y || 0) / 80)}-${orb?.color || "cyan"}`;
}

// ---------------------------------------------------------------------------
// IMPORTANT: la fel ca la fix-ul aplicat in modul anterior (BR Online),
// safeZoneRadius/worldWidth/worldHeight sunt citite DOAR din refs in
// interiorul buclei requestAnimationFrame, NU sunt dependente ale
// useEffect-ului care porneste bucla de desen. In Battle Royale Players,
// zona se strange continuu tot meciul (10 minute) - daca raza ar fi
// dependenta, React ar reporni bucla RAF la fiecare schimbare de raza
// (de multe ori pe secunda), dublul costului de randare pe canvas.
// Bucla porneste o singura data la montare si ruleaza stabil tot meciul.
// ---------------------------------------------------------------------------
function BattleRoyalePlayersMiniMap({
  player,
  worldWidth,
  worldHeight,
  orbs = [],
  cores = [],
  safeZoneRadius = null,
  players = [],
}) {
  const canvasRef = useRef(null);
  const stableOrbsRef = useRef([]);
  const lastOrbsUpdateRef = useRef(0);

  const safeZoneRadiusRef = useRef(safeZoneRadius);
  const worldWidthRef = useRef(worldWidth);
  const worldHeightRef = useRef(worldHeight);
  const coresRef = useRef(cores);
  const playersRef = useRef(players);
  const playerRef = useRef(player);

  safeZoneRadiusRef.current = safeZoneRadius;
  worldWidthRef.current = worldWidth;
  worldHeightRef.current = worldHeight;
  coresRef.current = Array.isArray(cores) ? cores : [];
  playersRef.current = Array.isArray(players) ? players : [];
  playerRef.current = player;

  const playerX = clamp(((player?.x || 0) / Math.max(1, worldWidth || 1)) * 100, 0, 100);
  const playerY = clamp(((player?.y || 0) / Math.max(1, worldHeight || 1)) * 100, 0, 100);

  const limitedOrbs = useMemo(() => {
    if (!Array.isArray(orbs)) return [];
    return orbs.slice(0, 260);
  }, [orbs]);

  useEffect(() => {
    const now = performance.now();

    if (!stableOrbsRef.current.length || now - lastOrbsUpdateRef.current > 900) {
      const previousByKey = new Map(stableOrbsRef.current.map((orb) => [getStableOrbKey(orb), orb]));

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
  }, [limitedOrbs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;

    const draw = () => {
      const currentSafeZoneRadius = safeZoneRadiusRef.current;
      const currentWorldWidth = worldWidthRef.current;
      const currentWorldHeight = worldHeightRef.current;
      const currentCores = coresRef.current;
      const currentPlayers = playersRef.current;
      const currentPlayer = playerRef.current;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

      const shouldDrawZone =
        Number(currentSafeZoneRadius) > 0 &&
        Number(currentSafeZoneRadius) < Math.min(Number(currentWorldWidth) || 0, Number(currentWorldHeight) || 0) / 2;

      if (shouldDrawZone) {
        const zoneW = clamp(((currentSafeZoneRadius * 2) / Math.max(1, currentWorldWidth || 1)) * w, 0, w - 8);
        const zoneH = clamp(((currentSafeZoneRadius * 2) / Math.max(1, currentWorldHeight || 1)) * h, 0, h - 8);

        ctx.beginPath();
        ctx.ellipse(cx, cy, zoneW / 2, zoneH / 2, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(90, 255, 110, 0.9)";
        ctx.lineWidth = 2;
        // Niciun shadowBlur cu animatie/pulsatie - linie statica, simpla.
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(70, 255, 100, 0.6)";
        ctx.stroke();
      }

      for (const orb of stableOrbsRef.current) {
        const point = mapPoint(orb, currentWorldWidth, currentWorldHeight, w, h, 5);
        const color = ORB_COLORS[orb.color] || ORB_COLORS.cyan;

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = color;
        ctx.globalAlpha = 0.88;
        ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const core of currentCores) {
        const point = mapPoint(core, currentWorldWidth, currentWorldHeight, w, h, 10);
        const color = CORE_COLORS[core.type] || "#00eaff";

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowBlur = 9;
        ctx.shadowColor = color;
        ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.shadowBlur = 0;
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Alti jucatori vii pe minimap - puncte simple, fara glow excesiv.
      for (const other of currentPlayers) {
        if (!other || other.alive === false || other.id === currentPlayer?.id) continue;

        const point = mapPoint(other, currentWorldWidth, currentWorldHeight, w, h, 6);
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 90, 90, 0.92)";
        ctx.shadowBlur = 3;
        ctx.shadowColor = "rgba(255, 90, 90, 0.7)";
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // Array de dependente VID intentionat - vezi comentariul de mai sus.
  }, []);

  return (
    <div className="brp-minimap">
      <canvas ref={canvasRef} className="brp-minimap-canvas" />
      <div className="brp-minimap-title">WORLD MAP</div>

      <div className="brp-minimap-map-area">
        <div
          className={`brp-minimap-player-dot brp-minimap-dot-${player?.skin || "cyan"}`}
          style={{
            left: `${playerX}%`,
            top: `${playerY}%`,
          }}
        />
      </div>
    </div>
  );
}

export default BattleRoyalePlayersMiniMap;
