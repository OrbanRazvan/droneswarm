import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import NormalPvpArena from "../NormalPvpArena/NormalPvpArena";
import BattleRoyale from "../BattleRoyaleMode/BattleRoyaleMode";
import ZonePvpArena from "../ZonePvpArena/ZonePvpArena";
import CapturetheFlag from "../CapturetheFlag/CapturetheFlag";
import Shop from "../Shop/Shop";
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
  tagline: id === "cyan" ? "Standard issue arena chassis." : "Premium arena chassis configuration.",
  description:
    id === "cyan"
      ? "A balanced all-purpose chassis engineered for precise control, clear battlefield visibility, reliable offense, and durable defense."
      : "A fully synchronized arena skin package with a matching hull, rotor assembly, shield aura, mini-drone swarm, and attack-drone finish.",
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
          ? "Four complete cosmetic configurations for the hull, rotor array, shield aura, and mini-drone swarm."
          : `${skins.length} remaining skins from the current collection.`,
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

const DEFAULT_CTF_PACK_ID = "ctf-pack-starter-command";

function getCtfPackStorageKey(user) {
  return `drone-swarm-ctf-pack-${user?.id || user?.email || user?.username || "player"}`;
}

function persistUserSnapshot(user, updates = {}) {
  const nextUser = {
    ...(user || {}),
    ...updates,
  };

  try {
    const savedUser = JSON.parse(localStorage.getItem("user") || "null");
    const mergedUser = {
      ...(savedUser || {}),
      ...nextUser,
    };

    localStorage.setItem("user", JSON.stringify(mergedUser));
    return mergedUser;
  } catch {
    return nextUser;
  }
}

function persistSelectedDrone(user, skinId) {
  const selected = normalizeSkin(skinId);

  try {
    localStorage.setItem(getStorageKey(user), selected);
  } catch {
    // Browser storage is optional.
  }

  return persistUserSnapshot(user, {
    selectedSkin: selected,
    selectedDrone: selected,
    selectedDroneSkin: selected,
    skin: selected,
  });
}

function getInitialSelectedCtfPack(user) {
  const accountValue = String(user?.selectedCtfPackId || "").trim();
  if (accountValue) return accountValue;

  try {
    return localStorage.getItem(getCtfPackStorageKey(user)) || DEFAULT_CTF_PACK_ID;
  } catch {
    return DEFAULT_CTF_PACK_ID;
  }
}

function persistSelectedCtfPack(user, packId) {
  const selected = String(packId || DEFAULT_CTF_PACK_ID).trim() || DEFAULT_CTF_PACK_ID;

  try {
    localStorage.setItem(getCtfPackStorageKey(user), selected);
  } catch {
    // Browser storage is optional.
  }

  return persistUserSnapshot(user, { selectedCtfPackId: selected });
}

function getDisplayName(user) {
  return user?.username || user?.firstName || user?.email?.split("@")?.[0] || "Player";
}



/* -------------------------------------------------------------------------
   STATIC HANGAR / SHOP PREVIEWS
   These SVG previews reuse the same chassis coordinates, rotor positions and
   CTF role silhouettes as PixiArenaRenderer, but are ordinary static DOM
   vectors: no WebGL canvas, no ticker, no spinning animation.
------------------------------------------------------------------------- */

const CTF_PREVIEW_PACKS = [
  {
    id: "ctf-pack-starter-command",
    kind: "ctf",
    starter: true,
    family: "Starter Command",
    name: "Starter Command Pack",
    price: "FREE",
    subtitle: "The default CTF deployment set: a fast Cadet Scout, reinforced Cadet Bastion, and perimeter-ready Cadet Sentinel.",
    skins: [
      { id: "ctf-blue-attack-alpha-basic-scout", name: "Cadet Scout", role: "ATTACK", family: "starter", colors: ["#2f7fff", "#eaf7ff", "#061322", "#ffd166"] },
      { id: "ctf-blue-tank-basic-bastion", name: "Cadet Bastion", role: "TANK", family: "starter", colors: ["#2f7fff", "#eaf7ff", "#061322", "#ffd166"] },
      { id: "ctf-blue-defense-basic-sentinel", name: "Cadet Sentinel", role: "DEFENDER", family: "starter", colors: ["#2f7fff", "#eaf7ff", "#061322", "#ffd166"] },
    ],
  },
  {
    id: "ctf-pack-galactic-command",
    kind: "ctf",
    family: "Galactic Command",
    name: "Galactic Command Pack",
    price: "€3.00",
    subtitle: "A three-unit command formation featuring an ion interceptor, armored flag carrier, and perimeter defense platform.",
    skins: [
      { id: "ctf-blue-attack-alpha-raptor", name: "Ion Raptor", role: "ATTACK", family: "galactic", colors: ["#00ddff", "#9dfff8", "#00192d", "#f2ffff"] },
      { id: "ctf-blue-tank-bastion", name: "Bastion Core", role: "TANK", family: "galactic", colors: ["#2878ff", "#9ec6ff", "#07173d", "#eaf5ff"] },
      { id: "ctf-blue-defense-aegis", name: "Aegis Grid", role: "DEFENDER", family: "galactic", colors: ["#00c4af", "#a8fff2", "#002b2b", "#f0fffc"] },
    ],
  },
  {
    id: "ctf-pack-medieval-forge",
    kind: "ctf",
    family: "Medieval Forge",
    name: "Medieval Forge Pack",
    price: "€3.00",
    subtitle: "An arcane-forge trio built around rune plating, reinforced siege armor, and a warded defense core.",
    skins: [
      { id: "ctf-blue-attack-alpha-viper", name: "Rune Viper", role: "ATTACK", family: "medieval", colors: ["#31ffc8", "#b7ffea", "#002d27", "#f3fffa"] },
      { id: "ctf-blue-tank-juggernaut", name: "Juggernaut Rune", role: "TANK", family: "medieval", colors: ["#00aeef", "#91e5ff", "#002c47", "#f1fdff"] },
      { id: "ctf-blue-defense-warden", name: "Warden Crest", role: "DEFENDER", family: "medieval", colors: ["#3bb6ff", "#c7ecff", "#08264a", "#f8fdff"] },
    ],
  },
  {
    id: "ctf-pack-military-prototype",
    kind: "ctf",
    family: "Military Prototype",
    name: "Military Prototype Pack",
    price: "€3.00",
    subtitle: "A tactical three-drone set with angular armor, active sensor arrays, and hardened objective control.",
    skins: [
      { id: "ctf-blue-attack-alpha-talon", name: "Talon Strike", role: "ATTACK", family: "military", colors: ["#16a7ff", "#8de2ff", "#03204f", "#f0fbff"] },
      { id: "ctf-blue-tank-atlas", name: "Atlas Plate", role: "TANK", family: "military", colors: ["#147acb", "#a4e2ff", "#06233b", "#f5fcff"] },
      { id: "ctf-blue-defense-bulwark", name: "Bulwark Node", role: "DEFENDER", family: "military", colors: ["#0bc5c1", "#b0fffa", "#003738", "#f1ffff"] },
    ],
  },
  {
    id: "ctf-pack-dark-galactic",
    kind: "ctf",
    family: "Dark Galactic",
    name: "Dark Galactic Pack",
    price: "€3.00",
    subtitle: "A dark-galactic strike formation with void-reactor hulls, stealth geometry, and cold-ion systems.",
    skins: [
      { id: "ctf-blue-attack-alpha-dark-voidfang", name: "Voidfang", role: "ATTACK", family: "dark-galactic", colors: ["#203f8f", "#9cbef5", "#020511", "#56caf1"] },
      { id: "ctf-blue-tank-dark-voidfang", name: "Voidfang Bastion", role: "TANK", family: "dark-galactic", colors: ["#0f3c68", "#9ad5f5", "#01050c", "#47cbf1"] },
      { id: "ctf-blue-defense-dark-voidfang", name: "Voidfang Aegis", role: "DEFENDER", family: "dark-galactic", colors: ["#1a6367", "#a2f0f5", "#02090c", "#54f1d2"] },
    ],
  },
];

function getPreviewColors(skin) {
  if (Array.isArray(skin?.colors) && skin.colors.length >= 4) {
    return skin.colors;
  }

  const current = typeof skin === "string" ? skin : skin?.id;
  const colors = getColors(current || "cyan");
  return [colors.primary, colors.secondary, colors.dark, colors.highlight];
}

function getCtfRoleFromSkin(skin) {
  if (skin?.role) return String(skin.role).toUpperCase();
  const id = String(skin?.id || skin || "").toLowerCase();

  if (id.includes("tank")) return "TANK";
  if (id.includes("defense")) return "DEFENDER";
  return id.startsWith("ctf-") ? "ATTACK" : "";
}

function getCtfFamilyFromSkin(skin) {
  if (skin?.family) return String(skin.family).toLowerCase();
  const id = String(skin?.id || skin || "").toLowerCase();
  if (id.includes("basic-")) return "starter";
  if (id.includes("dark-")) return "dark-galactic";
  if (/(viper|valkyrie|scythe|helix|juggernaut|citadel|warden|oracle)/.test(id)) return "medieval";
  if (/(talon|eclipse|atlas|bulwark)/.test(id)) return "military";
  return "galactic";
}

function StaticRotor({ x, y, primary, secondary, dark, highlight, compact = false }) {
  const r = compact ? 15 : 23;
  const core = compact ? 3.7 : 5.5;
  const blade = compact ? 9 : 14;

  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={dark} stroke={secondary} strokeWidth={compact ? 1.8 : 2.8} />
      <circle cx={x} cy={y} r={r - (compact ? 3 : 5)} fill="#020713" stroke={primary} strokeWidth={compact ? 1 : 1.4} opacity="0.92" />
      <path d={`M ${x - blade} ${y - blade * 0.34} L ${x + blade} ${y + blade * 0.34}`} stroke={secondary} strokeWidth={compact ? 2.8 : 4.5} opacity="0.55" strokeLinecap="round" />
      <path d={`M ${x - blade * 0.34} ${y + blade} L ${x + blade * 0.34} ${y - blade}`} stroke={primary} strokeWidth={compact ? 2.8 : 4.5} opacity="0.46" strokeLinecap="round" />
      <circle cx={x} cy={y} r={core + 2} fill={dark} />
      <circle cx={x} cy={y} r={core} fill={primary} />
      <circle cx={x - core * 0.32} cy={y - core * 0.38} r={Math.max(1.1, core * 0.34)} fill={highlight} />
    </g>
  );
}

function StaticCtfSignature({ role, family, primary, secondary, dark, highlight }) {
  if (!role) return null;

  if (family === "starter") {
    // Starter Command uses one disciplined academy palette per team: enamel
    // blue/red, silver optics and gold command markings. Its class geometry is
    // intentionally separate from the paid collections.
    if (role === "ATTACK") {
      return (
        <g>
          <path d="M 0 -70 L 14 -39 L 38 -16 L 27 5 L 17 42 L 0 59 L -17 42 L -27 5 L -38 -16 L -14 -39 Z" fill={dark} stroke={secondary} strokeWidth="2.35" />
          <path d="M 0 -61 L 9 -34 L 29 -14 L 18 5 L 9 33 L 0 47 L -9 33 L -18 5 L -29 -14 L -9 -34 Z" fill={primary} />
          <path d="M -57 -9 L -25 -9 L -17 8 L -54 29 Z" fill={dark} stroke={secondary} strokeWidth="1.8" />
          <path d="M 57 -9 L 25 -9 L 17 8 L 54 29 Z" fill={dark} stroke={secondary} strokeWidth="1.8" />
          <path d="M -44 -4 L -27 -4 L -22 6 L -45 19 Z" fill={highlight} opacity="0.95" />
          <path d="M 44 -4 L 27 -4 L 22 6 L 45 19 Z" fill={highlight} opacity="0.95" />
          <path d="M 0 -53 L 7 -24 L 5 2 L 0 15 L -5 2 L -7 -24 Z" fill={secondary} />
        </g>
      );
    }
    if (role === "TANK") {
      return (
        <g>
          <rect x="-54" y="-45" width="108" height="90" rx="22" fill={dark} stroke={secondary} strokeWidth="2.8" />
          <path d="M -43 -37 L 43 -37 L 49 -14 L 38 35 L 19 55 L -19 55 L -38 35 L -49 -14 Z" fill={primary} />
          <rect x="-31" y="-29" width="62" height="20" rx="7" fill={dark} stroke={highlight} strokeWidth="1.8" />
          {[-26, -8, 8, 26].map((x) => <rect key={x} x={x - 5} y="-23" width="10" height="7" rx="2" fill={highlight} />)}
          <rect x="-59" y="-11" width="13" height="44" rx="5" fill={dark} stroke={highlight} strokeWidth="1.6" />
          <rect x="46" y="-11" width="13" height="44" rx="5" fill={dark} stroke={highlight} strokeWidth="1.6" />
        </g>
      );
    }
    return (
      <g>
        <path d="M 0 -68 L 38 -45 L 59 -7 L 49 35 L 20 64 L -20 64 L -49 35 L -59 -7 L -38 -45 Z" fill={dark} stroke={secondary} strokeWidth="2.7" />
        <path d="M 0 -57 L 30 -38 L 46 -5 L 37 26 L 15 52 L -15 52 L -37 26 L -46 -5 L -30 -38 Z" fill={primary} />
        <path d="M 0 -42 L 17 -21 L 25 0 L 15 24 L 0 40 L -15 24 L -25 0 L -17 -21 Z" fill={dark} stroke={highlight} strokeWidth="2.1" />
        <rect x="-64" y="-22" width="14" height="52" rx="5" fill={dark} stroke={highlight} strokeWidth="1.8" />
        <rect x="50" y="-22" width="14" height="52" rx="5" fill={dark} stroke={highlight} strokeWidth="1.8" />
        <path d="M -44 40 L 0 59 L 44 40" fill="none" stroke={highlight} strokeWidth="3.6" strokeLinecap="round" />
      </g>
    );
  }

  if (family === "dark-galactic") {    return (
      <g>
        <path d="M -78 -26 L -34 -31 L -18 -8 L -67 16 L -86 4 Z" fill={dark} stroke={secondary} strokeWidth="2.1" opacity="0.96" />
        <path d="M 78 -26 L 34 -31 L 18 -8 L 67 16 L 86 4 Z" fill={dark} stroke={secondary} strokeWidth="2.1" opacity="0.96" />
        <path d="M -70 -18 L -38 -20 L -28 -4 L -62 9 Z" fill={primary} opacity="0.62" />
        <path d="M 70 -18 L 38 -20 L 28 -4 L 62 9 Z" fill={primary} opacity="0.62" />
        <path d="M 0 -57 L 16 -14 L 10 31 L 0 46 L -10 31 L -16 -14 Z" fill={dark} stroke={secondary} strokeWidth="2.4" />
        <path d="M 0 -39 L 8 -12 L 6 18 L 0 27 L -6 18 L -8 -12 Z" fill={highlight} opacity="0.96" />
      </g>
    );
  }

  if (role === "ATTACK") {
    if (family === "medieval") {
      return (
        <g>
          <path d="M 0 -70 L 13 -44 L 27 -31 L 13 -22 L 0 -34 L -13 -22 L -27 -31 L -13 -44 Z" fill={dark} stroke={secondary} strokeWidth="2.2" />
          <path d="M -66 6 L -32 5 L -22 22 L -53 42 Z" fill={primary} stroke={highlight} strokeWidth="1.2" opacity="0.8" />
          <path d="M 66 6 L 32 5 L 22 22 L 53 42 Z" fill={primary} stroke={highlight} strokeWidth="1.2" opacity="0.8" />
        </g>
      );
    }
    if (family === "military") {
      return (
        <g>
          <path d="M -66 -20 L -34 -26 L -23 -3 L -58 18 Z" fill={dark} stroke={secondary} strokeWidth="1.8" />
          <path d="M 66 -20 L 34 -26 L 23 -3 L 58 18 Z" fill={dark} stroke={secondary} strokeWidth="1.8" />
          <path d="M -59 -16 L -37 -20 L -31 -5 L -53 10 Z" fill={primary} opacity="0.8" />
          <path d="M 59 -16 L 37 -20 L 31 -5 L 53 10 Z" fill={primary} opacity="0.8" />
        </g>
      );
    }
    return (
      <g>
        <path d="M -66 -9 L -26 -20 L -15 -4 L -54 30 Z" fill={dark} stroke={secondary} strokeWidth="1.8" />
        <path d="M 66 -9 L 26 -20 L 15 -4 L 54 30 Z" fill={dark} stroke={secondary} strokeWidth="1.8" />
        <path d="M -58 -4 L -27 -10 L -21 1 L -50 22 Z" fill={primary} opacity="0.75" />
        <path d="M 58 -4 L 27 -10 L 21 1 L 50 22 Z" fill={primary} opacity="0.75" />
        <path d="M 0 -41 L 10 -7 L 0 19 L -10 -7 Z" fill={highlight} opacity="0.94" />
      </g>
    );
  }

  if (role === "TANK") {
    if (family === "medieval") {
      return (
        <g>
          <path d="M -49 -31 L -27 -49 L 27 -49 L 49 -31 L 45 38 L 22 54 L -22 54 L -45 38 Z" fill={dark} stroke={secondary} strokeWidth="4" />
          <rect x="-24" y="-16" width="48" height="46" rx="13" fill={dark} opacity="0.72" />
          <circle cx="0" cy="6" r="13" fill={highlight} opacity="0.9" />
        </g>
      );
    }
    if (family === "military") {
      return (
        <g>
          <circle cx="0" cy="0" r="39" fill={dark} opacity="0.66" stroke={secondary} strokeWidth="4" />
          <circle cx="0" cy="0" r="28" fill="none" stroke={highlight} strokeWidth="2.5" opacity="0.76" />
          <path d="M -45 -28 L -60 16" stroke={primary} strokeWidth="9" opacity="0.72" strokeLinecap="round" />
          <path d="M 45 -28 L 60 16" stroke={primary} strokeWidth="9" opacity="0.72" strokeLinecap="round" />
        </g>
      );
    }
    return (
      <g>
        <rect x="-55" y="-6" width="14" height="44" rx="6" fill={dark} stroke={secondary} strokeWidth="2" />
        <rect x="41" y="-6" width="14" height="44" rx="6" fill={dark} stroke={secondary} strokeWidth="2" />
        <path d="M -42 -25 L 42 -25 L 50 13 L 31 46 L -31 46 L -50 13 Z" fill={dark} stroke={highlight} strokeWidth="2.2" />
        <path d="M -27 -32 L 27 -32 L 33 -17 L -33 -17 Z" fill={primary} opacity="0.85" />
      </g>
    );
  }

  if (family === "medieval") {
    return (
      <g>
        <rect x="-50" y="-27" width="15" height="54" rx="6" fill={dark} stroke={secondary} strokeWidth="2" />
        <rect x="35" y="-27" width="15" height="54" rx="6" fill={dark} stroke={secondary} strokeWidth="2" />
        <circle cx="0" cy="0" r="35" fill="none" stroke={highlight} strokeWidth="3.3" opacity="0.8" />
      </g>
    );
  }
  if (family === "military") {
    return (
      <g>
        <rect x="-57" y="-18" width="16" height="48" rx="7" fill={primary} stroke={highlight} strokeWidth="2" />
        <rect x="41" y="-18" width="16" height="48" rx="7" fill={primary} stroke={highlight} strokeWidth="2" />
        <path d="M -45 -39 L 0 -53 L 45 -39" fill="none" stroke={secondary} strokeWidth="5" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <circle cx="0" cy="0" r="55" fill="none" stroke={secondary} strokeWidth="4.2" opacity="0.85" />
      <path d="M -46 -16 L -61 5 L -43 29" fill="none" stroke={highlight} strokeWidth="4" opacity="0.78" />
      <path d="M 46 -16 L 61 5 L 43 29" fill="none" stroke={highlight} strokeWidth="4" opacity="0.78" />
    </g>
  );
}

function StaticDronePreview({ skin = BASIC_DRONE, drone, size = "large", compact = false, label = "" }) {
  const item = drone || skin || BASIC_DRONE;
  const [primary, secondary, dark, highlight] = getPreviewColors(item);
  const role = getCtfRoleFromSkin(item);
  const family = getCtfFamilyFromSkin(item);
  const className = `static-drone-preview static-drone-preview-${size} ${compact ? "is-compact" : ""} ${role ? "is-ctf" : ""}`;
  const title = item?.name || SKIN_NAMES[item?.id] || "Drone";

  const compactRotor = size === "tiny";
  return (
    <div className={className} aria-label={`${title} static preview`} title={title}>
      <svg viewBox="-130 -130 260 260" role="img" aria-hidden="true">
        <circle cx="0" cy="0" r="105" fill="none" stroke={primary} strokeOpacity="0.22" strokeWidth="2" />
        <circle cx="0" cy="0" r="85" fill={dark} fillOpacity="0.20" stroke={secondary} strokeOpacity="0.23" strokeWidth="1.2" />
        <g opacity="0.98">
          {[
            [-59, -45],
            [59, -45],
            [-59, 45],
            [59, 45],
          ].map(([x, y]) => {
            const fromX = x < 0 ? -21 : 21;
            const fromY = y < 0 ? -17 : 17;
            return (
              <g key={`${x}-${y}`}>
                <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={dark} strokeWidth="12" strokeLinecap="round" />
                <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={primary} strokeWidth="6.4" strokeLinecap="round" opacity="0.82" />
                <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={secondary} strokeWidth="1.35" strokeLinecap="round" opacity="0.85" />
              </g>
            );
          })}
          <StaticCtfSignature role={role} family={family} primary={primary} secondary={secondary} dark={dark} highlight={highlight} />
          {[
            [-59, -45],
            [59, -45],
            [-59, 45],
            [59, 45],
          ].map(([x, y]) => (
            <StaticRotor
              key={`rotor-${x}-${y}`}
              x={x}
              y={y}
              primary={primary}
              secondary={secondary}
              dark={dark}
              highlight={highlight}
              compact={compactRotor}
            />
          ))}
          <path d="M 0 -52 L 23 -39 L 34 -8 L 30 24 L 17 47 L 0 56 L -17 47 L -30 24 L -34 -8 L -23 -39 Z" fill={dark} />
          <path d="M 0 -47 L 17 -34 L 25 -7 L 22 21 L 12 40 L 0 47 L -12 40 L -22 21 L -25 -7 L -17 -34 Z" fill={primary} />
          <path d="M 0 -41 L 7 -26 L 9 12 L 4 34 L 0 39 L -4 34 L -9 12 L -7 -26 Z" fill={dark} fillOpacity="0.56" />
          <path d="M 0 -42 L 12 -29 L 11 -10 L 0 -2 L -11 -10 L -12 -29 Z" fill={secondary} fillOpacity="0.62" />
          <path d="M 0 -38 L 6 -29 L 5 -17 L 0 -13 L -5 -17 L -6 -29 Z" fill={highlight} fillOpacity="0.78" />
          <rect x="-24" y="8" width="8" height="18" rx="3" fill={dark} />
          <rect x="16" y="8" width="8" height="18" rx="3" fill={dark} />
          <rect x="-22" y="10" width="4" height="12" rx="2" fill={secondary} fillOpacity="0.52" />
          <rect x="18" y="10" width="4" height="12" rx="2" fill={secondary} fillOpacity="0.52" />
          <rect x="-8" y="29" width="16" height="13" rx="5" fill={dark} />
          <rect x="-5" y="32" width="10" height="7" rx="3" fill={highlight} fillOpacity="0.94" />
          <path d="M 0 -47 L 17 -34 L 25 -7 L 22 21 L 12 40 L 0 47 L -12 40 L -22 21 L -25 -7 L -17 -34 Z" fill="none" stroke={highlight} strokeOpacity="0.42" strokeWidth="1.7" />
        </g>
      </svg>
      {label ? <span className="static-drone-preview-label">{label}</span> : null}
    </div>
  );
}

const CTF_PACKS = CTF_PREVIEW_PACKS;

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
        <p className="global-record-empty">No records have been posted yet.</p>
      )}
    </article>
  );
}


function Dashboard({ user, gameMode, onExitToMenu, onUserUpdated }) {
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
  const [equippedCtfPackId, setEquippedCtfPackId] = useState(() =>
    isGuestUser ? DEFAULT_CTF_PACK_ID : getInitialSelectedCtfPack(user)
  );
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
    () => [...PREMIUM_PACKS, ...CTF_PACKS].find((pack) => pack.id === openedPackId),
    [openedPackId]
  );

  const selectedSkin = useMemo(() => {
    return ALL_SKINS.find((skin) => skin.id === normalizeSkin(selectedDrone)) || BASIC_DRONE;
  }, [selectedDrone]);

  const selectedCtfPack = useMemo(() => {
    return CTF_PACKS.find((pack) => pack.id === equippedCtfPackId) || CTF_PACKS[0];
  }, [equippedCtfPackId]);

  const ctfLoadoutSkins = useMemo(() => {
    const byRole = (role) =>
      selectedCtfPack?.skins?.find(
        (skin) => String(skin?.role || "").toUpperCase() === role,
      ) || null;

    return [
      byRole("ATTACK") || selectedCtfPack?.skins?.[0] || null,
      byRole("TANK") || selectedCtfPack?.skins?.[1] || null,
      byRole("DEFENDER") || selectedCtfPack?.skins?.[2] || null,
    ].filter(Boolean);
  }, [selectedCtfPack]);

  const ownedCount = isGuestUser ? 1 : ALL_SKINS.length;

  const syncSavedUser = (nextUser) => {
    if (!nextUser || isGuestUser) return;

    const normalizedUser = {
      ...nextUser,
      isGuest: false,
    };

    persistUserSnapshot(user, normalizedUser);
    onUserUpdated?.(normalizedUser);
  };

  const selectDrone = async (skinId) => {
    if (isGuestUser) {
      setSelectedDrone("cyan");
      setOpenedPackId(null);
      return;
    }

    const normalized = normalizeSkin(skinId);
    setSelectedDrone(normalized);
    persistSelectedDrone(user, normalized);

    try {
      const response = await fetch(`${API_URL}/auth/select-drone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.userId || user?.id,
          drone: normalized,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to save the drone selection.");
      }

      if (payload?.user) syncSavedUser(payload.user);
    } catch {
      // The selection remains usable in this tab/local browser if the backend
      // is temporarily unavailable; the next successful selection re-syncs it.
    }
  };

  const selectCtfPack = async (packId) => {
    if (isGuestUser) {
      setEquippedCtfPackId(DEFAULT_CTF_PACK_ID);
      setOpenedPackId(null);
      return;
    }

    const next = CTF_PACKS.some((pack) => pack.id === packId)
      ? packId
      : DEFAULT_CTF_PACK_ID;

    setEquippedCtfPackId(next);
    persistSelectedCtfPack(user, next);

    try {
      const response = await fetch(`${API_URL}/auth/select-ctf-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.userId || user?.id,
          ctfPackId: next,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to save the CTF pack selection.");
      }

      if (payload?.user) syncSavedUser(payload.user);
    } catch {
      // Keep the choice locally for the active browser if the API is briefly
      // offline. The server is retried on the next selection.
    }

    setOpenedPackId(null);
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
    // Guest pilots always deploy with the free Starter Command Pack.
    // Account pilots use their saved CTF loadout.
    ctfSelectedPackId: isGuestUser ? DEFAULT_CTF_PACK_ID : equippedCtfPackId,
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
        ) : selectedMode === "capture-the-flag" ? (
          <CapturetheFlag
            key={`capture-the-flag-${arenaSessionId}`}
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
            {isGuestUser ? "Guest hangar for " : "Hangar for "}
            <strong>{getDisplayName(user)}</strong>
          </p>
        </div>

        <nav className="hangar-top-actions">
          <button onClick={() => setActiveTab("hangar")}>Hangar</button>
          <button onClick={() => setActiveTab("shop")}>Shop</button>
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
              <span>No account or profile is created. A guest name appears globally only after reaching the Top 10.</span>
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
            className="secondary-wide capture-the-flag-wide"
            onClick={() => launchArena("capture-the-flag")}
          >
            Capture The Flag · 4v4
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
            <button
              className={activeTab === "shop" ? "active" : ""}
              onClick={() => setActiveTab("shop")}
            >
              Shop
            </button>
          </div>

          {activeTab === "hangar" && (
            <>
              <section className="hero-drone-card hangar-loadout-hero">
                <div className="hero-copy hangar-loadout-copy">
                  <span className={`pill ${selectedSkin.rarity === "Premium" ? "premium-pill" : ""}`}>
                    {selectedSkin.rarity}
                  </span>
                  <h2>{selectedSkin.name}</h2>
                  <p>{selectedSkin.description}</p>

                  <div className="hangar-ctf-summary">
                    <span>CAPTURE THE FLAG · 4V4 LOADOUT</span>
                    <strong>{selectedCtfPack?.name || "Galactic Command Pack"}</strong>
                    <small>
                      The equipped pack provides one Attack drone, one Tank, and one Defender.
                      Your team assignment and battlefield role remain randomized in every match.
                    </small>
                  </div>

                  <div className="hero-buttons">
                    {isGuestUser ? (
                      <div className="guest-locked-drone-note">
                        Guest pilots deploy with the Basic Drone and the free Starter Command Pack. Premium Arena skins and CTF loadouts require a Google account.
                      </div>
                    ) : (
                      <>
                        <button
                          className="primary-action"
                          onClick={() => selectDrone(selectedSkin.id)}
                        >
                          SELECT ARENA DRONE
                        </button>
                        <button className="dark-action" onClick={() => setActiveTab("shop")}>
                          OPEN SHOP
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="hangar-active-loadout-grid">
                  <article className="hangar-loadout-drone-card arena-card">
                    <header>
                      <span>ARENA MODES</span>
                      <strong>{selectedSkin.name}</strong>
                    </header>
                    <StaticDronePreview skin={selectedSkin} size="large" />
                    <small>Normal PvP · Battle Royale</small>
                  </article>

                  {ctfLoadoutSkins.map((skin) => (
                    <article
                      key={skin.id}
                      className={`hangar-loadout-drone-card ctf-card role-${String(skin.role || "attack").toLowerCase()}`}
                    >
                      <header>
                        <span>CTF · {skin.role}</span>
                        <strong>{skin.name}</strong>
                      </header>
                      <StaticDronePreview skin={skin} size="large" compact />
                      <small>Capture The Flag · 4v4</small>
                    </article>
                  ))}
                </div>
              </section>

              <section className={`career-stats-section ${isGuestUser ? "guest-global-records" : ""}`}>
                <div className="career-stats-heading">
                  <div>
                    <span>{isGuestUser ? "GLOBAL LEADERBOARDS" : "PILOT RECORDS"}</span>
                    <h3>{isGuestUser ? "Arena Champions" : "Combat Records"}</h3>
                  </div>
                  <p>
                    {gameStatsLoading
                      ? "Loading records..."
                      : isGuestUser
                        ? "Guest pilots have no persistent profile or personal record. Their name appears only after reaching the global Top 10."
                        : "Personal records and global standings are saved permanently."}
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

          {activeTab === "shop" && (
            <Shop
              regularPacks={PREMIUM_PACKS}
              ctfPacks={CTF_PACKS}
              selectedDrone={selectedDrone}
              equippedCtfPackId={equippedCtfPackId}
              isGuest={isGuestUser}
              onOpenPack={setOpenedPackId}
              StaticDronePreview={StaticDronePreview}
            />
          )}
        </section>
      </main>

      {openedPack && (
        <div className="pack-modal-backdrop" onClick={() => setOpenedPackId(null)}>
          <div className="pack-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenedPackId(null)}>
              ×
            </button>

            <span className={`pill ${
              openedPack.kind === "ctf"
                ? openedPack.starter
                  ? "starter-pack-pill"
                  : "ctf-pack-pill"
                : "premium-pill"
            }`}>
              {openedPack.kind === "ctf"
                ? openedPack.starter
                  ? "CTF STARTER LOADOUT"
                  : "CTF ROLE PACK"
                : "Premium Pack"}
            </span>
            <h2>{openedPack.name}</h2>
            <p>{openedPack.subtitle}</p>

            <div className={`modal-skin-grid ${openedPack.kind === "ctf" ? "modal-ctf-skin-grid" : ""}`}>
              {openedPack.skins.map((skin) => {
                const selected = openedPack.kind === "ctf"
                  ? equippedCtfPackId === openedPack.id
                  : selectedDrone === skin.id;

                return (
                  <button
                    key={skin.id}
                    className={`modal-skin-card ${selected ? "selected" : ""} ${openedPack.kind === "ctf" ? "ctf-modal-skin-card" : ""}`}
                    onClick={() => {
                      if (isGuestUser) return;
                      if (openedPack.kind === "ctf") selectCtfPack(openedPack.id);
                      else selectDrone(skin.id);
                    }}
                    disabled={isGuestUser}
                  >
                    <StaticDronePreview skin={skin} size="modal" compact={openedPack.kind === "ctf"} />
                    {openedPack.kind === "ctf" && <em>{skin.role}</em>}
                    <strong>{skin.name}</strong>
                    <span>
                      {isGuestUser
                        ? openedPack.kind === "ctf" && openedPack.starter
                          ? "Guest default loadout"
                          : "Guest · view only"
                        : openedPack.kind === "ctf"
                          ? selected ? "Equipped for Capture the Flag" : "Click to equip for CTF"
                          : selected ? "Selected for arena" : "Click to select"}
                    </span>
                  </button>
                );
              })}
            </div>

            {isGuestUser ? (
              openedPack.kind === "ctf" && openedPack.starter ? (
                <button className="buy-button ctf-buy-button" disabled>
                  GUEST STARTER LOADOUT ACTIVE
                </button>
              ) : (
                <button className="buy-button is-locked" disabled>
                  SIGN IN WITH GOOGLE TO UNLOCK
                </button>
              )
            ) : openedPack.kind === "ctf" ? (
              <button
                className="buy-button ctf-buy-button"
                onClick={() => selectCtfPack(openedPack.id)}
              >
                {equippedCtfPackId === openedPack.id
                  ? openedPack.starter
                    ? "STARTER LOADOUT EQUIPPED"
                    : "CTF PACK EQUIPPED"
                  : openedPack.starter
                    ? "EQUIP STARTER LOADOUT"
                    : `EQUIP CTF PACK ${openedPack.price}`}
              </button>
            ) : (
              <button
                className="buy-button"
                onClick={() => {
                  if (openedPack.skins[0]) selectDrone(openedPack.skins[0].id);
                  setOpenedPackId(null);
                }}
              >
                SELECT PACK {openedPack.price}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;
