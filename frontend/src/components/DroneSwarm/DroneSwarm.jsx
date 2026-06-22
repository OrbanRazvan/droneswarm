import { useEffect, useRef, useState } from "react";
import "./DroneSwarm.css";

function normalizeSkin(skin) {
  const normalized = String(skin || "cyan")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  if (!normalized || normalized === "basic" || normalized === "basic-drone") {
    return "cyan";
  }

  return normalized;
}

function QuadDrone({ index, count, radius, attackOffset, orbitRotation }) {
  const safeCount = Math.max(count, 1);

  const baseAngle = (index / safeCount) * Math.PI * 2;
  const orbitAngle = baseAngle + orbitRotation;

  const x = Math.cos(orbitAngle) * radius + attackOffset.x;
  const y = Math.sin(orbitAngle) * radius + attackOffset.y;

  return (
    <div
      className="quad-drone-wrap"
      style={{
        transform: `translate(${x}px, ${y}px)`,
      }}
    >
      <div className="quad-drone">
        <div className="arm arm-front-left" />
        <div className="arm arm-front-right" />
        <div className="arm arm-back-left" />
        <div className="arm arm-back-right" />

        <div className="rotor rotor-tl">
          <span />
        </div>
        <div className="rotor rotor-tr">
          <span />
        </div>
        <div className="rotor rotor-bl">
          <span />
        </div>
        <div className="rotor rotor-br">
          <span />
        </div>

        <div className="drone-shell" />
        <div className="drone-light" />
      </div>
    </div>
  );
}

function smoothAngle(current, target, speed = 0.08) {
  const diff = ((target - current + 540) % 360) - 180;
  return current + diff * speed;
}

function DroneSwarm({ player }) {
  const [, setFrame] = useState(0);
  const rotationRef = useRef(0);
  const frameRef = useRef(null);

  const droneCount = Math.min(player.drones || 0, 8);
  const skin = normalizeSkin(player.skin);

  useEffect(() => {
    const animate = () => {
      if (player.isMoving && typeof player.moveAngle === "number") {
        const targetRotation = (player.moveAngle * 180) / Math.PI + 90;

        rotationRef.current = smoothAngle(
          rotationRef.current,
          targetRotation,
          player.isBot ? 0.12 : 0.075
        );
      }

      setFrame((v) => v + 1);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [player.isMoving, player.moveAngle, player.isBot]);

  const mouseAngle = Math.atan2(
    (player.mouseY || player.y) - player.y,
    (player.mouseX || player.x) - player.x
  );

  const orbitRotation = Date.now() * (player.attacking ? 0.0032 : 0.00125);
  const radius = player.attacking && !player.isBot ? 165 : 135;

  const attackOffset =
    player.attacking && !player.isBot
      ? {
          x: Math.cos(mouseAngle) * 75,
          y: Math.sin(mouseAngle) * 75,
        }
      : { x: 0, y: 0 };

  return (
    <div
      className={`swarm swarm-${skin} ${
        player.attacking ? "is-attacking" : ""
      } ${player.shieldActive ? "has-shield" : ""} ${
        player.isBot ? "is-ai-bot" : ""
      }`}
      style={{
        left: player.x,
        top: player.y,

        "--move-rotation": `${rotationRef.current}deg`,
        "--lean-x": `${(player.moveX || 0) * 4}deg`,
        "--lean-y": `${(player.moveY || 0) * -4}deg`,
        "--lean-z": `${(player.moveX || 0) * 2}deg`,
      }}
    >
      <div className="swarm-aura" />
      <div className="orbit-line" />

      {player.shieldActive && (
        <div
          className={`drone-shield ${player.shieldHit ? "shield-hit" : ""}`}
          key={player.shieldHit || "shield-active"}
        >
          <div className="drone-shield-core" />
          <div className="drone-shield-glass" />
          <div className="drone-shield-hex" />

          <div className="shield-impact-wave" />

          <div className="shield-segment shield-top" />
          <div className="shield-segment shield-bottom" />
          <div className="shield-segment shield-left" />
          <div className="shield-segment shield-right" />
        </div>
      )}

      <div className="main-quad-drone">
        <div className="main-drone-tilt">
          <div className="main-arm arm-front-left" />
          <div className="main-arm arm-front-right" />
          <div className="main-arm arm-back-left" />
          <div className="main-arm arm-back-right" />

          <div className="main-rotor main-rotor-tl">
            <span />
          </div>
          <div className="main-rotor main-rotor-tr">
            <span />
          </div>
          <div className="main-rotor main-rotor-bl">
            <span />
          </div>
          <div className="main-rotor main-rotor-br">
            <span />
          </div>

          <div className="main-shell" />
          <div className="main-camera" />
          <div className="main-light" />
        </div>
      </div>

      {Array.from({ length: droneCount }).map((_, index) => (
        <QuadDrone
          key={`drone-${index}`}
          index={index}
          count={droneCount}
          radius={radius}
          attackOffset={attackOffset}
          orbitRotation={orbitRotation}
        />
      ))}
    </div>
  );
}

export default DroneSwarm;
