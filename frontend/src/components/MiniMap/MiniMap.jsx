import { useEffect, useRef } from "react";
import "./MiniMap.css";

const MINIMAP_DRAW_INTERVAL_MS = 83;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mapPoint(item, worldWidth, worldHeight, width, height, margin = 6) {
  const safeWorldWidth = Math.max(1, Number(worldWidth) || 1);
  const safeWorldHeight = Math.max(1, Number(worldHeight) || 1);

  return {
    x: clamp(((Number(item?.x) || 0) / safeWorldWidth) * width, margin, width - margin),
    y: clamp(((Number(item?.y) || 0) / safeWorldHeight) * height, margin, height - margin),
  };
}

function resolveMiniMapSkin(player) {
  const rawSkin = String(player?.skin || "").toLowerCase();
  if (rawSkin.includes("orange") || String(player?.team || "cyan") === "orange") return "orange";
  if (rawSkin.includes("red")) return "red";
  if (rawSkin.includes("purple")) return "purple";
  if (rawSkin.includes("green")) return "green";
  if (rawSkin.includes("pink")) return "pink";
  return "cyan";
}

function MiniMap({
  player,
  worldWidth,
  worldHeight,
  bases = [],
  flags = [],
  players = [],
}) {
  const canvasRef = useRef(null);
  const basesRef = useRef([]);
  const flagsRef = useRef([]);
  const teammatesRef = useRef([]);
  const worldWidthRef = useRef(worldWidth);
  const worldHeightRef = useRef(worldHeight);
  const viewerTeamRef = useRef("cyan");

  worldWidthRef.current = worldWidth;
  worldHeightRef.current = worldHeight;

  const viewerTeam = String(player?.team || "cyan") === "orange" ? "orange" : "cyan";
  const viewerId = String(player?.id || "");
  viewerTeamRef.current = viewerTeam;

  basesRef.current = Array.isArray(bases)
    ? bases.filter(
        (base) =>
          base &&
          Number.isFinite(Number(base.x)) &&
          Number.isFinite(Number(base.y)),
      )
    : [];

  flagsRef.current = Array.isArray(flags)
    ? flags.filter(
        (flag) =>
          flag &&
          Number.isFinite(Number(flag.x)) &&
          Number.isFinite(Number(flag.y)),
      )
    : [];

  // Tactical map policy: only the local squad is visible. Enemy drones,
  // orbs, energy cells, cores and safe-zone geometry are intentionally absent.
  teammatesRef.current = Array.isArray(players)
    ? players
        .filter((candidate) => {
          if (!candidate || candidate.alive === false) return false;
          if (viewerId && String(candidate?.id || "") === viewerId) return false;
          return (
            String(candidate?.team || "cyan") === viewerTeam &&
            Number.isFinite(Number(candidate?.x)) &&
            Number.isFinite(Number(candidate?.y))
          );
        })
        .slice(0, 7)
        .map((candidate) => ({
          id: String(candidate?.id || ""),
          x: Number(candidate.x || 0),
          y: Number(candidate.y || 0),
          moveAngle: Number(candidate?.moveAngle || 0),
          isMoving: Boolean(candidate?.isMoving),
        }))
    : [];

  const playerX = clamp(((Number(player?.x) || 0) / Math.max(1, Number(worldWidth) || 1)) * 100, 0, 100);
  const playerY = clamp(((Number(player?.y) || 0) / Math.max(1, Number(worldHeight) || 1)) * 100, 0, 100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return undefined;

    let frame = 0;
    let lastDrawAt = 0;

    const drawBase = (base, currentWorldWidth, currentWorldHeight, width, height) => {
      const point = mapPoint(base, currentWorldWidth, currentWorldHeight, width, height, 12);
      const isOwnBase = Boolean(base?.isOwnBase);
      const color = isOwnBase ? "#00eaff" : "#ff4658";
      const radiusInWorld = Number(base?.perimeterRadius || base?.radius || 520);
      const scale = Math.min(
        width / Math.max(1, Number(currentWorldWidth) || 1),
        height / Math.max(1, Number(currentWorldHeight) || 1),
      );
      const perimeterRadius = clamp(radiusInWorld * scale, 5, 22);

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, perimeterRadius, 0, Math.PI * 2);
      ctx.fillStyle = isOwnBase ? "rgba(0, 234, 255, 0.10)" : "rgba(255, 70, 88, 0.10)";
      ctx.fill();
      ctx.strokeStyle = isOwnBase ? "rgba(0, 234, 255, 0.92)" : "rgba(255, 70, 88, 0.92)";
      ctx.lineWidth = 1.45;
      ctx.stroke();

      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - 5.7);
      ctx.lineTo(point.x + 5.7, point.y);
      ctx.lineTo(point.x, point.y + 5.7);
      ctx.lineTo(point.x - 5.7, point.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.75, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
    };

    const drawFlag = (flag, currentWorldWidth, currentWorldHeight, width, height) => {
      const point = mapPoint(flag, currentWorldWidth, currentWorldHeight, width, height, 10);
      const isOwnFlag = Boolean(flag?.isOwnFlag);
      const color = isOwnFlag ? "#00eaff" : "#ff4d5f";
      const status = String(flag?.status || "home");

      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.globalAlpha = status === "carried" ? 1 : 0.96;

      if (status === "carried") {
        ctx.beginPath();
        ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
        ctx.strokeStyle = isOwnFlag ? "rgba(0, 234, 255, 0.38)" : "rgba(255, 77, 95, 0.38)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(-1.5, 5.8);
      ctx.lineTo(-1.5, -6.6);
      ctx.strokeStyle = "rgba(255,255,255,0.98)";
      ctx.lineWidth = 1.65;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-1.4, -6.3);
      ctx.lineTo(6.6, -3.9);
      ctx.lineTo(-1.4, -1.3);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      if (status === "dropped") {
        ctx.beginPath();
        ctx.arc(0, 3.25, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }

      ctx.restore();
    };

    const drawTeammate = (teammate, currentWorldWidth, currentWorldHeight, width, height, viewerTeam) => {
      const point = mapPoint(teammate, currentWorldWidth, currentWorldHeight, width, height, 9);
      const teammateColor = viewerTeam === "orange" ? "#ff6b76" : "#35d8ff";
      const teammateLight = viewerTeam === "orange" ? "#ffe0e4" : "#e8fbff";
      const heading = teammate.isMoving && Number.isFinite(teammate.moveAngle)
        ? teammate.moveAngle + Math.PI / 2
        : 0;

      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(heading);
      ctx.globalAlpha = 0.98;
      ctx.shadowBlur = 10;
      ctx.shadowColor = teammateColor;
      ctx.beginPath();
      ctx.moveTo(0, -6.2);
      ctx.lineTo(5.2, 4.6);
      ctx.lineTo(0, 2.2);
      ctx.lineTo(-5.2, 4.6);
      ctx.closePath();
      ctx.fillStyle = teammateColor;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(0, -3.5);
      ctx.lineTo(2.25, 1.5);
      ctx.lineTo(-2.25, 1.5);
      ctx.closePath();
      ctx.fillStyle = teammateLight;
      ctx.fill();
      ctx.restore();
    };

    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (now - lastDrawAt < MINIMAP_DRAW_INTERVAL_MS) return;
      lastDrawAt = now;

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

      const mapWidth = rect.width;
      const mapHeight = rect.height;

      for (const base of basesRef.current) {
        drawBase(base, currentWorldWidth, currentWorldHeight, mapWidth, mapHeight);
      }

      for (const flag of flagsRef.current) {
        drawFlag(flag, currentWorldWidth, currentWorldHeight, mapWidth, mapHeight);
      }

      for (const teammate of teammatesRef.current) {
        drawTeammate(teammate, currentWorldWidth, currentWorldHeight, mapWidth, mapHeight, viewerTeamRef.current);
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
          className={`minimap-player-drone minimap-drone-${resolveMiniMapSkin(player)}`}
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
