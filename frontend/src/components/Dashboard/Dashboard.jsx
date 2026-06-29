import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import NormalPvpArena from "../NormalPvpArena/NormalPvpArena";
import BattleRoyale from "../BattleRoyaleMode/BattleRoyaleMode";
import ZonePvpArena from "../ZonePvpArena/ZonePvpArena";
import Adventure from "../Adventure/Adventure";
import PixiArenaRenderer from "../PixiArenaRenderer/PixiArenaRenderer";
import "./Dashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const SKIN_THEMES = {
  cyan: ["#00eaff", "#78f7ff", "#003140", "#ffffff", "rgba(0, 234, 255, 0.78)"],
  red: ["#ff4040", "#ff9a9a", "#380000", "#ffffff", "rgba(255, 64, 64, 0.72)"],
  purple: ["#9b5cff", "#d5b6ff", "#180034", "#ffffff", "rgba(155, 92, 255, 0.74)"],
  orange: ["#ff9f1c", "#ffd166", "#4b2100", "#fff7e6", "rgba(255, 159, 28, 0.72)"],
  green: ["#19ff8a", "#8cffc4", "#00391f", "#ffffff", "rgba(25, 255, 138, 0.72)"],
  pink: ["#ff4fd8", "#ffb8ef", "#4d003c", "#ffffff", "rgba(255, 79, 216, 0.72)"],
  "ice-blue": ["#7de7ff", "#e7fbff", "#07314a", "#ffffff", "rgba(125, 231, 255, 0.78)"],
  "solar-gold": ["#ffd447", "#fff0a8", "#513a00", "#ffffff", "rgba(255, 212, 71, 0.75)"],
  "shadow-black": ["#2e3440", "#6b7280", "#05070c", "#bdeeff", "rgba(75, 85, 99, 0.82)"],
  "toxic-lime": ["#b6ff00", "#e8ff8a", "#284000", "#ffffff", "rgba(182, 255, 0, 0.76)"],
  "royal-violet": ["#6d28d9", "#c4b5fd", "#14002e", "#f8f5ff", "rgba(109, 40, 217, 0.78)"],
  "crimson-white": ["#dc143c", "#ffffff", "#43000d", "#fff5f7", "rgba(220, 20, 60, 0.75)"],
  "neon-teal": ["#00ffcc", "#a7ffee", "#003c33", "#ffffff", "rgba(0, 255, 204, 0.76)"],
  "ember-red": ["#ff5a1f", "#ffb86b", "#451100", "#fff0e6", "rgba(255, 90, 31, 0.78)"],
  "arctic-silver": ["#c7d2fe", "#f8fafc", "#1e293b", "#ffffff", "rgba(199, 210, 254, 0.78)"],
  "void-purple": ["#4c1d95", "#a78bfa", "#070012", "#e9d5ff", "rgba(76, 29, 149, 0.84)"],
  "plasma-pink": ["#ff00aa", "#ff7adf", "#3f0030", "#ffffff", "rgba(255, 0, 170, 0.8)"],
  "jade-black": ["#00a86b", "#86efac", "#001e14", "#eafff5", "rgba(0, 168, 107, 0.78)"],
  "azure-white": ["#38bdf8", "#ffffff", "#082f49", "#ffffff", "rgba(56, 189, 248, 0.78)"],
  "inferno-orange": ["#ff6b00", "#ffcf33", "#4a1300", "#fff4df", "rgba(255, 107, 0, 0.82)"],
  "midnight-blue": ["#1e3a8a", "#60a5fa", "#020617", "#dbeafe", "rgba(30, 58, 138, 0.84)"],
  "acid-green": ["#39ff14", "#c6ff8a", "#0f2b00", "#ffffff", "rgba(57, 255, 20, 0.8)"],
  "ruby-black": ["#e11d48", "#fb7185", "#09090b", "#ffe4e6", "rgba(225, 29, 72, 0.82)"],
  "ghost-white": ["#e5e7eb", "#ffffff", "#334155", "#ffffff", "rgba(229, 231, 235, 0.76)"],
  "cyber-yellow": ["#faff00", "#fff7ad", "#3a3800", "#ffffff", "rgba(250, 255, 0, 0.76)"],
  "deep-ocean": ["#006994", "#67e8f9", "#001b2e", "#e0ffff", "rgba(0, 105, 148, 0.82)"],
  "magenta-cyan": ["#ff00ff", "#00ffff", "#250033", "#ffffff", "rgba(255, 0, 255, 0.78)"],
  "bronze-steel": ["#b87333", "#d1d5db", "#2b1605", "#fff7ed", "rgba(184, 115, 51, 0.72)"],
  "electric-indigo": ["#4f46e5", "#93c5fd", "#0b102f", "#eef2ff", "rgba(79, 70, 229, 0.82)"],
  "dark-emerald": ["#047857", "#34d399", "#001f16", "#d1fae5", "rgba(4, 120, 87, 0.82)"],
  "emerald-rift-a": ["#00ff99", "#a7ffd7", "#00291a", "#ffffff", "rgba(0, 255, 153, 0.82)"],
  "emerald-rift-b": ["#00d47a", "#7cffc4", "#001f14", "#ffffff", "rgba(0, 212, 122, 0.82)"],
  "emerald-rift-c": ["#45ffb0", "#d8ffef", "#003322", "#ffffff", "rgba(69, 255, 176, 0.82)"],
};

const SKIN_NAMES = {
  cyan: "Basic Drone",
  red: "Red Comet",
  purple: "Purple Nova",
  orange: "Orange Pulse",
  green: "Green Viper",
  pink: "Pink Flare",
  "ice-blue": "Ice Blue",
  "solar-gold": "Solar Gold",
  "shadow-black": "Shadow Black",
  "toxic-lime": "Toxic Lime",
  "royal-violet": "Royal Violet",
  "crimson-white": "Crimson White",
  "neon-teal": "Neon Teal",
  "ember-red": "Ember Red",
  "arctic-silver": "Arctic Silver",
  "void-purple": "Void Purple",
  "plasma-pink": "Plasma Pink",
  "jade-black": "Jade Black",
  "azure-white": "Azure White",
  "inferno-orange": "Inferno Orange",
  "midnight-blue": "Midnight Blue",
  "acid-green": "Acid Green",
  "ruby-black": "Ruby Black",
  "ghost-white": "Ghost White",
  "cyber-yellow": "Cyber Yellow",
  "deep-ocean": "Deep Ocean",
  "magenta-cyan": "Magenta Cyan",
  "bronze-steel": "Bronze Steel",
  "electric-indigo": "Electric Indigo",
  "dark-emerald": "Dark Emerald",
};

function normalizeSkin(skin) {
  const clean = String(skin || "cyan").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (!clean || clean === "basic" || clean === "basic-drone") return "cyan";
  return SKIN_THEMES[clean] ? clean : "cyan";
}

function getColors(id) {
  const [primary, secondary, dark, highlight, glow] = SKIN_THEMES[normalizeSkin(id)] || SKIN_THEMES.cyan;
  return { primary, secondary, dark, highlight, glow };
}

const ALL_SKINS = Object.keys(SKIN_THEMES).map((id) => ({
  id,
  name: SKIN_NAMES[id] || id,
  rarity: id === "cyan" ? "Starter" : "Premium",
  price: id === "cyan" ? 0 : 3,
  owned: true,
  tagline: id === "cyan" ? "Drona de start." : "Skin complet pentru arena.",
  description:
    id === "cyan"
      ? "Drona standard pentru arena. Are echilibru bun intre control, vizibilitate, atac si aparare."
      : "Skin complet sincronizat cu jocul real: corp, elice, aura, mini drone si attack drone folosesc aceeasi tema de culoare.",
  parts: {
    body: "Glossy Aero Shell",
    rotors: "Neon Rotor Set",
    miniDrones: "Matching Mini Swarm",
    aura: "Shield Aura",
    projectile: "Attack Drone Skin",
  },
  colors: getColors(id),
}));

const BASIC_DRONE = ALL_SKINS.find((skin) => skin.id === "cyan");

const PACK_NAMES = [
  "Starter Neon Pack",
  "Storm Glow Pack",
  "Chaos Rift Pack",
  "Arctic Pulse Pack",
  "Inferno Pack",
  "Shadow Tech Pack",
  "Cyber Core Pack",
  "Emerald Rift Pack",
];

const PREMIUM_PACKS = (() => {
  const premium = ALL_SKINS.filter((skin) => skin.id !== "cyan");
  const packs = [];

  for (let i = 0; i < premium.length; i += 4) {
    const skins = premium.slice(i, i + 4);
    packs.push({
      id: `premium-pack-${i / 4 + 1}`,
      name: PACK_NAMES[i / 4] || `Premium Pack ${i / 4 + 1}`,
      price: "€3.00",
      subtitle:
        skins.length === 4
          ? "4 skinuri complete pentru corp, elice, aura si mini drone."
          : `${skins.length} skinuri ramase din colectia actuala.`,
      skins,
    });
  }

  return packs;
})();

function getStorageKey(user) {
  return `drone-swarm-selected-skin-${user?.id || user?.email || user?.username || "guest"}`;
}

function getInitialSelectedDrone(user) {
  const userValue = normalizeSkin(
    user?.selectedSkin || user?.selectedDroneSkin || user?.selectedDrone || user?.skin || "cyan"
  );

  try {
    const stored = localStorage.getItem(getStorageKey(user));
    if (stored) return normalizeSkin(stored);

    const savedUser = JSON.parse(localStorage.getItem("user") || "null");
    const savedValue = normalizeSkin(
      savedUser?.selectedSkin || savedUser?.selectedDroneSkin || savedUser?.selectedDrone || savedUser?.skin || ""
    );

    if (savedValue && SKIN_THEMES[savedValue]) return savedValue;
  } catch {
    // localStorage poate fi blocat in unele browsere.
  }

  return userValue;
}

function persistSelectedDrone(user, skinId) {
  const selected = normalizeSkin(skinId);

  try {
    localStorage.setItem(getStorageKey(user), selected);

    const savedUser = JSON.parse(localStorage.getItem("user") || "null");
    const nextUser = {
      ...(savedUser || user || {}),
      selectedSkin: selected,
      selectedDrone: selected,
      selectedDroneSkin: selected,
      skin: selected,
    };

    localStorage.setItem("user", JSON.stringify(nextUser));
  } catch {
    // Nu blocam jocul daca browserul refuza localStorage.
  }
}

function getDisplayName(user) {
  return user?.username || user?.firstName || user?.email?.split("@")?.[0] || "Player";
}


function PackPixiPreview({ skins = [] }) {
  const viewWidth = 1600;
  const viewHeight = 430;
  const worldCenterX = 1000;
  const worldCenterY = 1000;

  const previewWorldScale = 1;
  const previewSizeMultiplier = 0.58;

  const cameraX = viewWidth / 2 - worldCenterX * previewWorldScale;
  const cameraY = viewHeight / 2 - worldCenterY * previewWorldScale;

  const slots = [
    { x: worldCenterX - 570, y: worldCenterY, mouseX: worldCenterX - 490, mouseY: worldCenterY - 118 },
    { x: worldCenterX - 190, y: worldCenterY, mouseX: worldCenterX - 110, mouseY: worldCenterY - 118 },
    { x: worldCenterX + 190, y: worldCenterY, mouseX: worldCenterX + 270, mouseY: worldCenterY - 118 },
    { x: worldCenterX + 570, y: worldCenterY, mouseX: worldCenterX + 650, mouseY: worldCenterY - 118 },
  ];

  const previewUnits = skins.slice(0, 4).map((skin, index) => ({
    id: `pack-preview-${skin.id}-${index}`,
    username: skin.name,
    x: slots[index]?.x || worldCenterX,
    y: slots[index]?.y || worldCenterY,
    mouseX: slots[index]?.mouseX || worldCenterX + 120,
    mouseY: slots[index]?.mouseY || worldCenterY - 120,
    moveX: 0,
    moveY: 0,
    skin: normalizeSkin(skin.id),
    hp: 100,
    energy: 100,
    alive: true,
    drones: 1,
    attacking: false,
    isBot: false,
    previewSizeMultiplier,
  }));

  const mainUnit = previewUnits[0] || {
    id: "pack-preview-empty",
    username: "Preview",
    x: worldCenterX,
    y: worldCenterY,
    mouseX: worldCenterX + 120,
    mouseY: worldCenterY - 120,
    moveX: 0,
    moveY: 0,
    skin: "cyan",
    hp: 100,
    energy: 100,
    alive: true,
    drones: 1,
    attacking: false,
    isBot: false,
    previewSizeMultiplier,
  };

  return (
    <div className="dashboard-pack-pixi-preview">
      <div className="dashboard-pack-pixi-preview-inner">
        <PixiArenaRenderer
          player={mainUnit}
          players={previewUnits.slice(1)}
          bots={[]}
          simpleBots={[]}
          orbs={[]}
          energyCells={[]}
          cores={[]}
          projectiles={[]}
          simpleProjectiles={[]}
          cameraX={cameraX}
          cameraY={cameraY}
          scale={previewWorldScale}
          viewportWidth={viewWidth}
          viewportHeight={viewHeight}
          coreTypes={[]}
          otherPlayerQuality={2}
          staticPreview={true}
        />
      </div>
    </div>
  );
}

function DronePreview({ skin = BASIC_DRONE, size = "large", compact = false }) {
  const previewSkin = normalizeSkin(skin?.id || skin);
  const previewConfig = {
    hero: { box: 430, scale: 1 },
    modal: { box: 430, scale: 0.62 },
    large: { box: 430, scale: 0.40 },
    tiny: { box: 430, scale: 0.27 },
  }[size] || { box: 430, scale: 0.40 };

  const worldCenter = 1000;
  const viewSize = 430;
  const cameraX = viewSize / 2 - worldCenter;
  const cameraY = viewSize / 2 - worldCenter;

  const previewPlayer = {
    id: `dashboard-preview-${previewSkin}`,
    username: skin?.name || previewSkin,
    x: worldCenter,
    y: worldCenter,
    mouseX: worldCenter + 120,
    mouseY: worldCenter - 160,
    moveX: 0,
    moveY: 0,
    skin: previewSkin,
    hp: 100,
    energy: 100,
    alive: true,
    drones: 1,
    attacking: false,
    isBot: false,
  };

  return (
    <div
      className={`dashboard-pixi-preview dashboard-pixi-preview-${size} ${compact ? "is-compact" : ""}`}
      style={{ "--dash-preview-scale": previewConfig.scale }}
    >
      <div
        className="dashboard-pixi-preview-inner"
        style={{ width: previewConfig.box, height: previewConfig.box }}
      >
        <PixiArenaRenderer
          player={previewPlayer}
          players={[]}
          bots={[]}
          simpleBots={[]}
          orbs={[]}
          energyCells={[]}
          cores={[]}
          projectiles={[]}
          simpleProjectiles={[]}
          cameraX={cameraX}
          cameraY={cameraY}
          scale={1}
          viewportWidth={viewSize}
          viewportHeight={viewSize}
          coreTypes={[]}
          otherPlayerQuality={2}
          staticPreview={true}
        />
      </div>
    </div>
  );
}


const GUEST_STATS_KEY_STORAGE = "drone-swarm-guest-leaderboard-key";

function createGuestStatsKey() {
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;

  return `guest_${generated}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 160);
}

function getGuestStatsKey() {
  try {
    const existing = sessionStorage.getItem(GUEST_STATS_KEY_STORAGE);
    if (existing && /^[A-Za-z0-9_-]{16,160}$/.test(existing)) {
      return existing;
    }

    const next = createGuestStatsKey();
    sessionStorage.setItem(GUEST_STATS_KEY_STORAGE, next);
    return next;
  } catch {
    return createGuestStatsKey();
  }
}

function createEmptyGameStats() {
  return {
    personal: {
      normalPvp: { bestKills: 0, wins: 0 },
      battleRoyalePve: { bestKills: 0, wins: 0 },
      battleRoyalePvp: { bestKills: 0, wins: 0 },
    },
    leaderboards: {
      normalPvp: [],
      battleRoyalePvp: [],
    },
  };
}

function PlayerRecordCard({ title, bestKills = 0, wins = 0, showWins = true }) {
  return (
    <article className="player-record-card">
      <span>{title}</span>
      <div className="player-record-values">
        <div>
          <b>{Number(bestKills || 0)}</b>
          <small>BEST KILLS / MATCH</small>
        </div>
        {showWins && (
          <div>
            <b>{Number(wins || 0)}</b>
            <small>MATCH WINS</small>
          </div>
        )}
      </div>
    </article>
  );
}

function GlobalRecordTable({ title, entries = [], showWins = false }) {
  return (
    <article className="global-record-table">
      <header>
        <h4>{title}</h4>
        <span>GLOBAL TOP 10</span>
      </header>

      <div className={`global-record-head ${showWins ? "with-wins" : ""}`}>
        <span>#</span>
        <span>PILOT</span>
        {showWins && <span>WINS</span>}
        <span>BEST KILLS</span>
      </div>

      {entries.length > 0 ? (
        entries.slice(0, 10).map((entry, index) => (
          <div
            key={`${entry.userId || entry.guestKey || entry.username || "pilot"}-${index}`}
            className={`global-record-row ${showWins ? "with-wins" : ""}`}
          >
            <b>{index + 1}</b>
            <strong>{entry.username || "Pilot"}</strong>
            {showWins && <em>{Number(entry.wins || 0)}</em>}
            <em>{Number(entry.bestKills || 0)}</em>
          </div>
        ))
      ) : (
        <p className="global-record-empty">Nu exista inca recorduri salvate.</p>
      )}
    </article>
  );
}


function Dashboard({ user, gameMode, onExitToMenu }) {
  const isGuestUser = Boolean(user?.isGuest);
  const guestDisplayName = getDisplayName(user);
  // Guest-ul are doar o cheie anonimă de sesiune pentru Top 10. Nu se creează
  // GameUser, Player, email sau profil persistent în baza de date.
  const guestStatsKey = useMemo(
    () => (isGuestUser ? getGuestStatsKey() : null),
    [isGuestUser],
  );

  const [screen, setScreen] = useState(gameMode ? "arena" : "hangar");
  const [selectedMode, setSelectedMode] = useState(gameMode || "pvp");
  // Every press creates a fresh arena instance. This prevents an old socket
  // from being reused after staying open in another mode or guest session.
  const [arenaSessionId, setArenaSessionId] = useState(0);
  const [activeTab, setActiveTab] = useState("hangar");
  const [selectedDrone, setSelectedDrone] = useState(() =>
    isGuestUser ? "cyan" : getInitialSelectedDrone(user)
  );
  const [openedPackId, setOpenedPackId] = useState(null);
  const [gameStats, setGameStats] = useState(() => createEmptyGameStats());
  const [gameStatsLoading, setGameStatsLoading] = useState(false);
  const gameStatsSocketRef = useRef(null);

  // Switch global de calitate grafica (Normal/Low), aplicat la TOATE
  // modurile de joc (Normal PvP, Battle Royale, Zone PvP, Battle Royale
  // Online), nu doar la unul. Persistat in localStorage ca preferinta sa
  // ramana intre sesiuni. Pasat ca prop simplu fiecarei arene - schimbarea
  // switch-ului in timpul unui meci se aplica de la urmatoarea intrare in
  // arena (PixiArenaRenderer il citeste o singura data la montare), nu live.
  const [graphicsQuality, setGraphicsQuality] = useState(() => {
    try {
      const stored = localStorage.getItem("drone-swarm-graphics-quality");
      return stored === "low" ? "low" : "normal";
    } catch {
      return "normal";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("drone-swarm-graphics-quality", graphicsQuality);
    } catch {
      // localStorage poate fi blocat in unele browsere - nu blocam jocul.
    }
  }, [graphicsQuality]);

  useEffect(() => {
    if (isGuestUser) {
      if (selectedDrone !== "cyan") setSelectedDrone("cyan");
      return;
    }

    persistSelectedDrone(user, selectedDrone);
  }, [selectedDrone, user, isGuestUser]);

  useEffect(() => {
    if (isGuestUser && activeTab === "shop") {
      setActiveTab("hangar");
    }
  }, [isGuestUser, activeTab]);

  // Recordurile sunt cerute doar în Hangar. Guest-ul primește exclusiv
  // clasamentele globale; recordurile personale/PvE rămân doar pentru conturi.
  useEffect(() => {
    if (screen !== "hangar") return undefined;

    let disposed = false;
    let timeoutId = null;

    setGameStatsLoading(true);

    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      timeout: 8000,
    });

    gameStatsSocketRef.current = socket;

    const requestStats = () => {
      if (!socket.connected) return;
      socket.emit("game-stats:get", {
        userId: isGuestUser ? null : user?.userId || user?.id || null,
        isGuest: isGuestUser,
        guestKey: isGuestUser ? guestStatsKey : null,
      });
    };

    const applyStats = (payload) => {
      if (disposed) return;
      setGameStats(
        payload && (payload.personal || payload.leaderboards)
          ? payload
          : createEmptyGameStats(),
      );
      setGameStatsLoading(false);
    };

    // Global topurile trebuie să se actualizeze pentru orice pilot — inclusiv
    // Guest — fără refresh. Serverul trimite invalidarea imediat ce un record
    // nou intră/iese din Top 10, iar polling-ul scurt este fallback-ul sigur
    // pentru un tab care a pierdut un eveniment Socket.IO în background.
    const refreshLeaderboards = () => requestStats();
    const refreshTimer = window.setInterval(requestStats, 2500);

    socket.on("connect", requestStats);
    socket.on("game-stats:payload", applyStats);
    socket.on("game-stats:updated", applyStats);
    socket.on("game-stats:leaderboards-updated", refreshLeaderboards);

    timeoutId = window.setTimeout(() => {
      if (!disposed) setGameStatsLoading(false);
    }, 4000);

    return () => {
      disposed = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      window.clearInterval(refreshTimer);
      socket.off("connect", requestStats);
      socket.off("game-stats:payload", applyStats);
      socket.off("game-stats:updated", applyStats);
      socket.off("game-stats:leaderboards-updated", refreshLeaderboards);
      socket.disconnect();
      if (gameStatsSocketRef.current === socket) {
        gameStatsSocketRef.current = null;
      }
    };
  }, [guestStatsKey, isGuestUser, screen, user?.id, user?.userId]);

  const openedPack = useMemo(
    () => PREMIUM_PACKS.find((pack) => pack.id === openedPackId),
    [openedPackId]
  );

  const selectedSkin = useMemo(() => {
    return ALL_SKINS.find((skin) => skin.id === normalizeSkin(selectedDrone)) || BASIC_DRONE;
  }, [selectedDrone]);

  const ownedCount = isGuestUser ? 1 : ALL_SKINS.length;

  const selectDrone = (skinId) => {
    if (isGuestUser) {
      setSelectedDrone("cyan");
      setOpenedPackId(null);
      return;
    }

    const normalized = normalizeSkin(skinId);
    setSelectedDrone(normalized);
    persistSelectedDrone(user, normalized);
  };

  const arenaSelectedDrone = isGuestUser ? "cyan" : selectedDrone;

  const arenaUser = {
    ...user,
    id: isGuestUser ? null : user?.id,
    userId: isGuestUser ? null : user?.userId || user?.id,
    email: isGuestUser ? null : user?.email,
    isGuest: isGuestUser,
    // Folosit doar pentru recordurile globale guest din Normal/PvP Zone.
    guestStatsKey: isGuestUser ? guestStatsKey : null,
    username: guestDisplayName,
    selectedDrone: arenaSelectedDrone,
    selectedSkin: arenaSelectedDrone,
    selectedDroneSkin: arenaSelectedDrone,
    skin: arenaSelectedDrone,
  };

  const launchArena = (mode) => {
    // Guest poate juca toate cele trei moduri. Doar zona Combat Records nu
    // afiseaza recorduri personale sau Battle Royale PvE pentru Guest.
    setArenaSessionId((value) => value + 1);
    setSelectedMode(mode);
    setScreen("arena");
  };

  const handleExitToHangar = () => {
    setScreen("hangar");
    setSelectedMode("pvp");

    if (onExitToMenu) {
      onExitToMenu();
    }
  };

  if (screen === "arena") {
    return (
      <div className="dashboard">
        {selectedMode === "normal-pvp" ? (
          <NormalPvpArena
            key={`normal-pvp-${arenaSessionId}`}
            user={arenaUser}
            onExitToMenu={handleExitToHangar}
            graphicsQuality={graphicsQuality}
          />
        ) : selectedMode === "battle-royale" ? (
          <BattleRoyale
            key={`battle-royale-${arenaSessionId}`}
            user={arenaUser}
            onExitToMenu={handleExitToHangar}
            graphicsQuality={graphicsQuality}
          />
        ) : selectedMode === "adventure" ? (
          <Adventure
            key={`adventure-${arenaSessionId}`}
            user={arenaUser}
            onExitToMenu={handleExitToHangar}
            graphicsQuality={graphicsQuality}
          />
        ) : (
          <ZonePvpArena
            key={`zone-pvp-${arenaSessionId}`}
            user={arenaUser}
            onExitToMenu={handleExitToHangar}
            graphicsQuality={graphicsQuality}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`dashboard dashboard-hangar ${isGuestUser ? "dashboard-guest-mode" : ""}`}>
      <div className="hangar-bg-grid" />

      <header className="hangar-header">
        <div>
          <h1>DRONE SWARM</h1>
          <p>
            {isGuestUser ? "Guest mode pentru " : "Hangar pentru "}
            <strong>{getDisplayName(user)}</strong>
          </p>
        </div>

        <nav className="hangar-top-actions">
          <button onClick={() => setActiveTab("hangar")}>Hangar</button>
          {!isGuestUser && <button onClick={() => setActiveTab("shop")}>Shop</button>}
          <button
            className="logout-btn"
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              sessionStorage.removeItem("token");
              sessionStorage.removeItem("user");
              sessionStorage.removeItem("droneSwarmGuestUser");
              sessionStorage.removeItem(GUEST_STATS_KEY_STORAGE);
              window.location.reload();
            }}
          >
            {isGuestUser ? "Exit Guest" : "Logout"}
          </button>
        </nav>
      </header>

      <main className="hangar-layout">
        <aside className={`pilot-card ${isGuestUser ? "pilot-card-guest" : ""}`}>
          {!isGuestUser && (
            <div className="pilot-avatar">
              {getDisplayName(user).slice(0, 1).toUpperCase()}
            </div>
          )}

          <h2>{getDisplayName(user)}</h2>

          {isGuestUser ? (
            <div className="guest-profile-note">
              <strong>GUEST MODE</strong>
              <span>Nu se creeaza cont sau profil. Doar un record care intra in Top 10 poate ramane afisat global.</span>
            </div>
          ) : (
            <p>{user?.email || "player@drone-swarm.com"}</p>
          )}

          {!isGuestUser && (
            <div className="rank-box">
              <span>RANK</span>
              <strong>Rookie Pilot</strong>
            </div>
          )}

          <div className={`pilot-mini-grid ${isGuestUser ? "pilot-mini-grid-guest" : ""}`}>
            <div>
              <span>DRONE</span>
              <strong>{isGuestUser ? "Basic Drone" : selectedSkin.name}</strong>
            </div>
            {!isGuestUser && (
              <div>
                <span>COINS</span>
                <strong>0</strong>
              </div>
            )}
            {!isGuestUser && (
              <div>
                <span>OWNED</span>
                <strong>{ownedCount} / {ALL_SKINS.length}</strong>
              </div>
            )}
            <div>
              <span>{isGuestUser ? "LEADERBOARD" : "SERVER"}</span>
              <strong>{isGuestUser ? "TOP 10 ONLY" : "EU"}</strong>
            </div>
          </div>

          <button
            className="secondary-wide normal-pvp-wide"
            onClick={() => launchArena("normal-pvp")}
          >
            Normal PVP
          </button>

          <button
            className="secondary-wide battle-royale-mode-wide"
            onClick={() => launchArena("battle-royale")}
          >
            Battle Royale - PVE
          </button>

          <button
            className="secondary-wide zone-pvp-wide"
            onClick={() => launchArena("zone-pvp")}
          >
            Battle Royale - PVP
          </button>

          <button
            className="secondary-wide adventure-mode-wide"
            onClick={() => launchArena("adventure")}
          >
            Adventure
          </button>

        </aside>

        <section className="hangar-panel">
          <div className="hangar-tabs">
            <button
              className={activeTab === "hangar" ? "active" : ""}
              onClick={() => setActiveTab("hangar")}
            >
              Hangar
            </button>
            {!isGuestUser && (
              <button
                className={activeTab === "shop" ? "active" : ""}
                onClick={() => setActiveTab("shop")}
              >
                Shop
              </button>
            )}
          </div>

          {activeTab === "hangar" && (
            <>
              <section className="hero-drone-card">
                <div className="hero-copy">
                  <span className={`pill ${selectedSkin.rarity === "Premium" ? "premium-pill" : ""}`}>
                    {selectedSkin.rarity}
                  </span>
                  <h2>{selectedSkin.name}</h2>
                  <p>{selectedSkin.description}</p>

                  <div className="hero-buttons">
                    {isGuestUser ? (
                      <div className="guest-locked-drone-note">
                        Guest poate folosi doar Basic Drone. Skinurile premium si selectia de drone sunt disponibile doar cu Google.
                      </div>
                    ) : (
                      <>
                        <button
                          className="primary-action"
                          onClick={() => selectDrone(selectedSkin.id)}
                        >
                          SELECT DRONE
                        </button>
                        <button className="dark-action" onClick={() => setActiveTab("shop")}>
                          Shop
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <DronePreview skin={selectedSkin} size="hero" />
              </section>

              <section className={`career-stats-section ${isGuestUser ? "guest-global-records" : ""}`}>
                <div className="career-stats-heading">
                  <div>
                    <span>{isGuestUser ? "GLOBAL LEADERBOARDS" : "PILOT RECORDS"}</span>
                    <h3>{isGuestUser ? "Arena Champions" : "Combat Records"}</h3>
                  </div>
                  <p>
                    {gameStatsLoading
                      ? "Se incarca recordurile..."
                      : isGuestUser
                        ? "Guest-ul nu are profil sau record personal. Numele lui apare doar daca intra in Top 10."
                        : "Recordurile personale si clasamentele globale sunt salvate permanent."}
                  </p>
                </div>

                {!isGuestUser && (
                  <div className="player-record-grid">
                    <PlayerRecordCard
                      title="NORMAL PVP"
                      bestKills={gameStats.personal?.normalPvp?.bestKills}
                      showWins={false}
                    />
                    <PlayerRecordCard
                      title="BATTLE ROYALE · PVE"
                      bestKills={gameStats.personal?.battleRoyalePve?.bestKills}
                      wins={gameStats.personal?.battleRoyalePve?.wins}
                    />
                    <PlayerRecordCard
                      title="BATTLE ROYALE · PVP"
                      bestKills={gameStats.personal?.battleRoyalePvp?.bestKills}
                      wins={gameStats.personal?.battleRoyalePvp?.wins}
                    />
                  </div>
                )}

                <div className="global-record-grid">
                  <GlobalRecordTable
                    title="Normal PvP Records"
                    entries={gameStats.leaderboards?.normalPvp || []}
                  />
                  <GlobalRecordTable
                    title="Battle Royale PvP Champions"
                    entries={gameStats.leaderboards?.battleRoyalePvp || []}
                    showWins
                  />
                </div>
              </section>
            </>
          )}

          {!isGuestUser && activeTab === "shop" && (
            <section className="shop-section">
              <div className="section-title-row">
                <h3>Premium Packs</h3>
                <p>Fiecare pachet va costa €3.00. Momentan poti selecta orice drona pentru test.</p>
              </div>

              <div className="pack-grid">
                {PREMIUM_PACKS.map((pack) => (
                  <article key={pack.id} className="premium-pack-card">
                    <div className="pack-preview-strip pack-preview-strip-real-pixi">
                      <PackPixiPreview skins={pack.skins} />
                    </div>

                    <div>
                      <span className="pill premium-pill">Premium Pack</span>
                      <h3>{pack.name}</h3>
                      <p>{pack.subtitle}</p>
                    </div>

                    <div className="pack-actions">
                      <strong>{pack.price}</strong>
                      <button onClick={() => setOpenedPackId(pack.id)}>OPEN PACK</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      </main>

      {!isGuestUser && openedPack && (
        <div className="pack-modal-backdrop" onClick={() => setOpenedPackId(null)}>
          <div className="pack-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenedPackId(null)}>
              ×
            </button>

            <span className="pill premium-pill">Premium Pack</span>
            <h2>{openedPack.name}</h2>
            <p>{openedPack.subtitle}</p>

            <div className="modal-skin-grid">
              {openedPack.skins.map((skin) => (
                <button
                  key={skin.id}
                  className={`modal-skin-card ${selectedDrone === skin.id ? "selected" : ""}`}
                  onClick={() => selectDrone(skin.id)}
                >
                  <DronePreview skin={skin} size="modal" />
                  <strong>{skin.name}</strong>
                  <span>
                    {selectedDrone === skin.id
                      ? "Selected for arena"
                      : "Click pentru selectie"}
                  </span>
                </button>
              ))}
            </div>

            <button
              className="buy-button"
              onClick={() => {
                if (openedPack.skins[0]) selectDrone(openedPack.skins[0].id);
              }}
            >
              SELECT PACK {openedPack.price}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
