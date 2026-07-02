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
    subtitle: "The default 4v4 deployment set: a fast Cadet Scout, reinforced Cadet Bastion, and perimeter-ready Cadet Sentinel.",
    skins: [
      { id: "ctf-blue-attack-alpha-basic-scout", name: "Cadet Scout", role: "ATTACK", family: "starter", colors: ["#00b9d7", "#9af6ff", "#04212e", "#f4feff"] },
      { id: "ctf-blue-tank-basic-bastion", name: "Cadet Bastion", role: "TANK", family: "starter", colors: ["#2166cf", "#9bc8ff", "#081735", "#f2f8ff"] },
      { id: "ctf-blue-defense-basic-sentinel", name: "Cadet Sentinel", role: "DEFENDER", family: "starter", colors: ["#00a994", "#a5fff0", "#002a28", "#f1fffc"] },
    ],
  },
  {
    id: "ctf-pack-galactic-command",
    kind: "ctf",
    family: "Galactic Command",
    name: "Galactic Command Pack",
    price: "€3.00",
    subtitle: "Ion strike hardware with a knife-edge interceptor, command carrier armor, and a high-energy perimeter shield.",
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
    subtitle: "Arcane-fused combat frames with lance geometry, rune-forged siege plating, and a warded shield citadel.",
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
    subtitle: "Low-profile tactical frames built from stealth facets, armored field plates, and fortified sensor barricades.",
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
    subtitle: "Void-reactor hulls with razor stealth wings, siege-grade shadow plating, and cold-ion defense hardware.",
    skins: [
      { id: "ctf-blue-attack-alpha-dark-voidfang", name: "Voidfang", role: "ATTACK", family: "dark-galactic", colors: ["#203f8f", "#9cbef5", "#020511", "#56caf1"] },
      { id: "ctf-blue-tank-dark-voidfang", name: "Voidfang Dreadnought", role: "TANK", family: "dark-galactic", colors: ["#0f3c68", "#9ad5f5", "#01050c", "#47cbf1"] },
      { id: "ctf-blue-defense-dark-voidfang", name: "Voidfang Aegis", role: "DEFENDER", family: "dark-galactic", colors: ["#1a6367", "#a2f0f5", "#02090c", "#54f1d2"] },
    ],
  },
  {
    id: "ctf-pack-abyssal-phantom",
    kind: "ctf",
    family: "Abyssal Phantom",
    name: "Abyssal Phantom Pack",
    price: "€3.00",
    subtitle: "Deep-sea stealth architecture: a manta interceptor, Leviathan siege chassis, and a tidal perimeter ward.",
    skins: [
      { id: "ctf-blue-attack-alpha-abyssal-razor", name: "Abyssal Razor", role: "ATTACK", family: "abyssal", colors: ["#0a6d8c", "#7df8ff", "#02131d", "#cffcff"] },
      { id: "ctf-blue-tank-abyssal-leviathan", name: "Leviathan Frame", role: "TANK", family: "abyssal", colors: ["#075985", "#86f5ff", "#031721", "#e2fdff"] },
      { id: "ctf-blue-defense-abyssal-ward", name: "Tidal Ward", role: "DEFENDER", family: "abyssal", colors: ["#0f766e", "#8bfff2", "#03201f", "#eaffff"] },
    ],
  },
  {
    id: "ctf-pack-solar-dynasty",
    kind: "ctf",
    family: "Solar Dynasty",
    name: "Solar Dynasty Pack",
    price: "€3.00",
    subtitle: "Regal solar-war machines with a lance fighter, plated sun-bastion, and a radiant halo defense field.",
    skins: [
      { id: "ctf-blue-attack-alpha-solar-lancer", name: "Solar Lancer", role: "ATTACK", family: "solar", colors: ["#f59e0b", "#fff1a6", "#2b1600", "#ffffff"] },
      { id: "ctf-blue-tank-solar-bastion", name: "Solar Bastion", role: "TANK", family: "solar", colors: ["#d97706", "#ffdfa0", "#2a1600", "#fffbeb"] },
      { id: "ctf-blue-defense-solar-halo", name: "Solar Halo", role: "DEFENDER", family: "solar", colors: ["#fbbf24", "#fff3b0", "#302000", "#fffff3"] },
    ],
  },
  {
    id: "ctf-pack-crimson-ronin",
    kind: "ctf",
    family: "Crimson Ronin",
    name: "Crimson Ronin Pack",
    price: "€3.00",
    subtitle: "Blade-forged combat hardware featuring a katana interceptor, Shogun command tank, and Torii gate defender.",
    skins: [
      { id: "ctf-blue-attack-alpha-ronin-blade", name: "Ronin Blade", role: "ATTACK", family: "ronin", colors: ["#e11d48", "#ffa8b8", "#23030d", "#fff4f6"] },
      { id: "ctf-blue-tank-ronin-shogun", name: "Shogun Frame", role: "TANK", family: "ronin", colors: ["#be123c", "#ff9daf", "#23020a", "#fff3f5"] },
      { id: "ctf-blue-defense-ronin-gate", name: "Torii Guard", role: "DEFENDER", family: "ronin", colors: ["#7c3aed", "#d9c5ff", "#18072f", "#f7f2ff"] },
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
  if (id.includes("abyssal-")) return "abyssal";
  if (id.includes("solar-")) return "solar";
  if (id.includes("ronin-")) return "ronin";
  if (/(viper|valkyrie|scythe|helix|juggernaut|citadel|warden|oracle)/.test(id)) return "medieval";
  if (/(talon|eclipse|atlas|bulwark)/.test(id)) return "military";
  return "galactic";
}

function StaticRotor({ x, y, primary, secondary, dark, highlight }) {
  const radius = 23;
  const hubRadius = 5.8;
  const bladeLength = radius * 0.64;

  return (
    <g>
      <circle cx={x} cy={y} r={radius} fill={dark} fillOpacity="0.95" />
      <circle cx={x} cy={y} r={radius - 2.8} fill="#020713" fillOpacity="0.9" />
      <circle cx={x} cy={y} r={radius} fill="none" stroke={secondary} strokeWidth="2.8" strokeOpacity="0.84" />
      <circle cx={x} cy={y} r={radius - 5.2} fill="none" stroke={primary} strokeWidth="1.55" strokeOpacity="0.58" />
      <path
        d={`M ${x - bladeLength} ${y - bladeLength * 0.34} L ${x + bladeLength} ${y + bladeLength * 0.34}`}
        fill="none"
        stroke={secondary}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeOpacity="0.42"
      />
      <path
        d={`M ${x - bladeLength * 0.34} ${y + bladeLength} L ${x + bladeLength * 0.34} ${y - bladeLength}`}
        fill="none"
        stroke={primary}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeOpacity="0.31"
      />
      <circle cx={x} cy={y} r={hubRadius + 2.2} fill={dark} />
      <circle cx={x} cy={y} r={hubRadius} fill={primary} />
      <circle cx={x - hubRadius * 0.32} cy={y - hubRadius * 0.38} r={hubRadius * 0.34} fill={highlight} fillOpacity="0.92" />
    </g>
  );
}

function getCtfVisualMeta(skin = {}) {
  const id = String(skin?.id || skin || "").toLowerCase();
  const roleFromId =
    id.includes("-attack-alpha-") ? "attack-alpha" :
    id.includes("-attack-bravo-") ? "attack-bravo" :
    id.includes("-tank-") ? "tank" :
    id.includes("-defense-") ? "defense" :
    "";

  const roleFromProp = String(skin?.role || "").toLowerCase();
  const role =
    roleFromId ||
    (roleFromProp.includes("tank") ? "tank" :
      roleFromProp.includes("defender") || roleFromProp.includes("defense") ? "defense" :
        roleFromProp.includes("attack") ? "attack-alpha" : "");

  const variantMatch = id.match(/(?:attack-alpha|attack-bravo|tank|defense)-(.+)$/);
  const variant = variantMatch?.[1] || "";

  const family =
    String(skin?.family || "").toLowerCase() ||
    (variant.startsWith("basic-") ? "starter" :
      variant.startsWith("dark-") ? "dark-galactic" :
      variant.startsWith("abyssal-") ? "abyssal" :
      variant.startsWith("solar-") ? "solar" :
      variant.startsWith("ronin-") ? "ronin" :
      /^(viper|valkyrie|scythe|helix|juggernaut|citadel|warden|oracle)$/.test(variant) ? "medieval" :
      /^(talon|eclipse|atlas|bulwark)$/.test(variant) ? "military" :
      "galactic");

  return { role, variant, family, isCtf: Boolean(id.startsWith("ctf-") || role) };
}

function StaticCtfArm({ x, y, fromX, fromY, width, accentWidth, primary, secondary, dark, highlight }) {
  return (
    <g>
      <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={dark} strokeWidth={width} strokeLinecap="round" />
      <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={primary} strokeWidth={accentWidth} strokeLinecap="round" strokeOpacity="0.88" />
      <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={secondary} strokeWidth="1.25" strokeLinecap="round" strokeOpacity="0.76" />
      <StaticRotor x={x} y={y} primary={primary} secondary={secondary} dark={dark} highlight={highlight} />
    </g>
  );
}

function StaticCtfFactionSignature({ family, role, primary, secondary, dark, highlight }) {
  if (family === "dark-galactic") {
    return (
      <g>
        <path d="M -78 -26 L -34 -31 L -18 -8 L -67 16 L -86 4 Z" fill={dark} stroke={secondary} strokeWidth="2.2" strokeOpacity="0.72" />
        <path d="M 78 -26 L 34 -31 L 18 -8 L 67 16 L 86 4 Z" fill={dark} stroke={secondary} strokeWidth="2.2" strokeOpacity="0.72" />
        <path d="M -70 -18 L -38 -20 L -28 -4 L -62 9 Z" fill={primary} fillOpacity="0.58" />
        <path d="M 70 -18 L 38 -20 L 28 -4 L 62 9 Z" fill={primary} fillOpacity="0.58" />
        <path d="M 0 -57 L 16 -14 L 10 31 L 0 46 L -10 31 L -16 -14 Z" fill={dark} stroke={secondary} strokeWidth="2.5" strokeOpacity="0.80" />
        <path d="M 0 -39 L 8 -12 L 6 18 L 0 27 L -6 18 L -8 -12 Z" fill={highlight} fillOpacity="0.98" />
        {[-20, 0, 20].map((x) => <rect key={x} x={x - 4} y="34" width="8" height="15" rx="3" fill={secondary} fillOpacity="0.82" />)}
      </g>
    );
  }

  if (family === "galactic") {
    return (
      <g>
        <path d="M -66 -9 L -26 -20 L -15 -4 L -54 30 Z" fill={dark} stroke={secondary} strokeWidth="1.8" strokeOpacity="0.76" />
        <path d="M 66 -9 L 26 -20 L 15 -4 L 54 30 Z" fill={dark} stroke={secondary} strokeWidth="1.8" strokeOpacity="0.76" />
        <path d="M -58 -4 L -27 -10 L -21 1 L -50 22 Z" fill={primary} fillOpacity="0.72" />
        <path d="M 58 -4 L 27 -10 L 21 1 L 50 22 Z" fill={primary} fillOpacity="0.72" />
        <path d="M 0 -41 L 10 -7 L 0 19 L -10 -7 Z" fill={highlight} fillOpacity="0.94" />
        {[-13, 0, 13].map((x) => <path key={x} d={`M ${x - 3} 25 L ${x + 3} 25 L ${x + 1} 34 L ${x - 1} 34 Z`} fill={secondary} fillOpacity="0.92" />)}
      </g>
    );
  }

  if (family === "medieval") {
    return (
      <g>
        <path d="M 0 -70 L 13 -44 L 27 -31 L 13 -22 L 0 -34 L -13 -22 L -27 -31 L -13 -44 Z" fill={dark} stroke={secondary} strokeWidth="2.3" strokeOpacity="0.82" />
        <path d="M -66 6 L -32 5 L -22 22 L -53 42 Z" fill={primary} fillOpacity="0.72" stroke={highlight} strokeWidth="1.35" strokeOpacity="0.62" />
        <path d="M 66 6 L 32 5 L 22 22 L 53 42 Z" fill={primary} fillOpacity="0.72" stroke={highlight} strokeWidth="1.35" strokeOpacity="0.62" />
        {[-16, 0, 16].map((x) => <path key={x} d={`M ${x} 14 L ${x + 6} 27 L ${x} 40 L ${x - 6} 27 Z`} fill={highlight} fillOpacity="0.86" />)}
      </g>
    );
  }

  return (
    <g>
      <path d="M -66 -20 L -34 -26 L -23 -3 L -58 18 Z" fill={dark} stroke={secondary} strokeWidth="1.8" strokeOpacity="0.74" />
      <path d="M 66 -20 L 34 -26 L 23 -3 L 58 18 Z" fill={dark} stroke={secondary} strokeWidth="1.8" strokeOpacity="0.74" />
      <path d="M -59 -16 L -37 -20 L -31 -5 L -53 10 Z" fill={primary} fillOpacity="0.78" />
      <path d="M 59 -16 L 37 -20 L 31 -5 L 53 10 Z" fill={primary} fillOpacity="0.78" />
      <path d="M -26 -48 L 26 -48 L 33 -33 L -33 -33 Z" fill={dark} stroke={secondary} strokeWidth="1.55" strokeOpacity="0.72" />
      {[-12, 0, 12].map((x) => <path key={x} d={`M ${x - 3} -44 L ${x + 3} -44 L ${x + 2} -38 L ${x - 2} -38 Z`} fill={highlight} fillOpacity="0.98" />)}
    </g>
  );
}

function StaticCtfVariantDetails({ role, variant, family, primary, secondary, dark, highlight }) {
  if (family === "dark-galactic") {
    if (variant === "dark-voidfang") {
      return (
        <g fill="none" stroke={highlight} strokeWidth="4.4" strokeLinecap="round" strokeOpacity="0.82">
          <path d="M -64 13 L -31 31 L -55 46" />
          <path d="M 64 13 L 31 31 L 55 46" />
        </g>
      );
    }
    return null;
  }

  const key = `${role}:${variant}`;
  switch (key) {
    case "attack-alpha:raptor":
      return (
        <g>
          <path d="M -31 12 L -12 18 L -28 42 L -49 27 Z" fill={secondary} fillOpacity="0.72" />
          <path d="M 31 12 L 12 18 L 28 42 L 49 27 Z" fill={secondary} fillOpacity="0.72" />
          <path d="M -16 35 L 0 49 L 16 35" fill="none" stroke={highlight} strokeWidth="3.2" strokeOpacity="0.86" />
        </g>
      );
    case "attack-alpha:viper":
      return (
        <g>
          <path d="M -12 -54 L -3 -30 L -12 -3 L -26 -35 Z" fill={highlight} fillOpacity="0.84" />
          <path d="M 12 -54 L 3 -30 L 12 -3 L 26 -35 Z" fill={highlight} fillOpacity="0.84" />
          <path d="M -47 5 L -21 16 L -38 35 L -58 22 Z" fill={dark} fillOpacity="0.96" />
          <path d="M 47 5 L 21 16 L 38 35 L 58 22 Z" fill={dark} fillOpacity="0.96" />
          <circle cx="0" cy="4" r="11" fill={secondary} fillOpacity="0.62" />
        </g>
      );
    case "attack-alpha:talon":
      return (
        <g>
          <path d="M -48 -17 L -24 2 L -50 27" fill="none" stroke={secondary} strokeWidth="8" strokeLinecap="round" strokeOpacity="0.78" />
          <path d="M 48 -17 L 24 2 L 50 27" fill="none" stroke={secondary} strokeWidth="8" strokeLinecap="round" strokeOpacity="0.78" />
          <path d="M 0 -58 L 11 -24 L 0 7 L -11 -24 Z" fill={highlight} fillOpacity="0.92" />
          <rect x="-14" y="27" width="28" height="10" rx="4" fill={dark} stroke={primary} strokeWidth="2" strokeOpacity="0.72" />
        </g>
      );
    case "tank:bastion":
      return (
        <g>
          <rect x="-55" y="-6" width="14" height="44" rx="6" fill={dark} stroke={secondary} strokeWidth="2" strokeOpacity="0.68" />
          <rect x="41" y="-6" width="14" height="44" rx="6" fill={dark} stroke={secondary} strokeWidth="2" strokeOpacity="0.68" />
        </g>
      );
    case "tank:juggernaut":
      return (
        <g>
          <path d="M -49 -31 L -27 -49 L 27 -49 L 49 -31 L 45 38 L 22 54 L -22 54 L -45 38 Z" fill="none" stroke={secondary} strokeWidth="4.2" strokeOpacity="0.84" />
          <rect x="-24" y="-16" width="48" height="46" rx="13" fill={dark} fillOpacity="0.68" />
          <circle cx="0" cy="6" r="13" fill={highlight} fillOpacity="0.84" />
        </g>
      );
    case "tank:atlas":
      return (
        <g>
          <circle cx="0" cy="0" r="39" fill="none" stroke={secondary} strokeWidth="4.2" strokeOpacity="0.80" />
          <circle cx="0" cy="0" r="28" fill="none" stroke={highlight} strokeWidth="2.5" strokeOpacity="0.62" />
          <path d="M -45 -28 L -60 16" fill="none" stroke={primary} strokeWidth="9" strokeLinecap="round" strokeOpacity="0.62" />
          <path d="M 45 -28 L 60 16" fill="none" stroke={primary} strokeWidth="9" strokeLinecap="round" strokeOpacity="0.62" />
        </g>
      );
    case "defense:aegis":
      return (
        <g>
          <circle cx="0" cy="0" r="55" fill="none" stroke={secondary} strokeWidth="4.2" strokeOpacity="0.76" />
          <path d="M -46 -16 L -61 5 L -43 29" fill="none" stroke={highlight} strokeWidth="4" strokeLinecap="round" strokeOpacity="0.68" />
          <path d="M 46 -16 L 61 5 L 43 29" fill="none" stroke={highlight} strokeWidth="4" strokeLinecap="round" strokeOpacity="0.68" />
        </g>
      );
    case "defense:warden":
      return (
        <g>
          <rect x="-42" y="-27" width="15" height="54" rx="6" fill={dark} stroke={secondary} strokeWidth="2" strokeOpacity="0.72" />
          <rect x="35" y="-27" width="15" height="54" rx="6" fill={dark} stroke={secondary} strokeWidth="2" strokeOpacity="0.72" />
          <circle cx="0" cy="0" r="35" fill="none" stroke={highlight} strokeWidth="3.4" strokeOpacity="0.74" />
        </g>
      );
    case "defense:bulwark":
      return (
        <g>
          <rect x="-57" y="-18" width="16" height="48" rx="7" fill={primary} fillOpacity="0.78" stroke={highlight} strokeWidth="2" strokeOpacity="0.66" />
          <rect x="41" y="-18" width="16" height="48" rx="7" fill={primary} fillOpacity="0.78" stroke={highlight} strokeWidth="2" strokeOpacity="0.66" />
          <path d="M -45 -39 L 0 -53 L 45 -39" fill="none" stroke={secondary} strokeWidth="5" strokeLinecap="round" strokeOpacity="0.74" />
          <path d="M -45 37 L 0 53 L 45 37" fill="none" stroke={secondary} strokeWidth="5" strokeLinecap="round" strokeOpacity="0.74" />
        </g>
      );
    default:
      return null;
  }
}

function StaticStarterCommandHull({ role, primary, secondary, dark, highlight }) {
  const rotors = [[-59, -45], [59, -45], [-59, 45], [59, 45]];
  const armProps = (x, y, fromX, fromY, width, accentWidth) => (
    <StaticCtfArm
      key={`${x}-${y}`}
      x={x}
      y={y}
      fromX={fromX}
      fromY={fromY}
      width={width}
      accentWidth={accentWidth}
      primary={primary}
      secondary={secondary}
      dark={dark}
      highlight={highlight}
    />
  );

  if (role === "tank") {
    return (
      <g>
        {rotors.map(([x, y]) => armProps(x, y, x < 0 ? -31 : 31, y < 0 ? -15 : 22, 16, 7))}
        <rect x="-52" y="-44" width="104" height="88" rx="22" fill={dark} stroke={secondary} strokeWidth="2.6" strokeOpacity="0.82" />
        <path d="M -42 -37 L 42 -37 L 48 -15 L 37 35 L 19 55 L -19 55 L -37 35 L -48 -15 Z" fill={primary} fillOpacity="0.96" />
        <rect x="-30" y="-29" width="60" height="20" rx="7" fill={dark} stroke={highlight} strokeWidth="1.8" strokeOpacity="0.90" />
        {[-26, -8, 8, 26].map((x) => <rect key={x} x={x - 5} y="-23" width="10" height="7" rx="2" fill={highlight} fillOpacity="0.96" />)}
        <path d="M 0 -5 L 18 8 L 14 30 L 0 41 L -14 30 L -18 8 Z" fill={dark} fillOpacity="0.88" stroke={secondary} strokeWidth="2" strokeOpacity="0.86" />
        <path d="M 0 1 L 8 11 L 6 25 L 0 30 L -6 25 L -8 11 Z" fill={secondary} fillOpacity="0.96" />
        <rect x="-58" y="-12" width="13" height="44" rx="5" fill={dark} stroke={highlight} strokeWidth="1.65" strokeOpacity="0.76" />
        <rect x="45" y="-12" width="13" height="44" rx="5" fill={dark} stroke={highlight} strokeWidth="1.65" strokeOpacity="0.76" />
      </g>
    );
  }

  if (role === "defense") {
    return (
      <g>
        {rotors.map(([x, y]) => armProps(x, y, x < 0 ? -22 : 22, y < 0 ? -19 : 19, 12.6, 5.5))}
        <path d="M 0 -68 L 38 -45 L 59 -7 L 49 35 L 20 64 L -20 64 L -49 35 L -59 -7 L -38 -45 Z" fill={dark} stroke={secondary} strokeWidth="2.6" strokeOpacity="0.84" />
        <path d="M 0 -57 L 30 -38 L 46 -5 L 37 26 L 15 52 L -15 52 L -37 26 L -46 -5 L -30 -38 Z" fill={primary} fillOpacity="0.98" />
        <path d="M 0 -42 L 17 -21 L 25 0 L 15 24 L 0 40 L -15 24 L -25 0 L -17 -21 Z" fill={dark} fillOpacity="0.90" stroke={highlight} strokeWidth="2.1" strokeOpacity="0.90" />
        <path d="M 0 -29 L 8 -9 L 10 8 L 0 23 L -10 8 L -8 -9 Z" fill={secondary} fillOpacity="0.96" />
        <rect x="-64" y="-22" width="14" height="52" rx="5" fill={dark} stroke={highlight} strokeWidth="1.8" strokeOpacity="0.76" />
        <rect x="50" y="-22" width="14" height="52" rx="5" fill={dark} stroke={highlight} strokeWidth="1.8" strokeOpacity="0.76" />
        <path d="M -44 40 L 0 59 L 44 40" fill="none" stroke={highlight} strokeWidth="3.6" strokeLinecap="round" strokeOpacity="0.82" />
      </g>
    );
  }

  if (role === "attack-bravo") {
    return (
      <g>
        {rotors.map(([x, y], index) => armProps(x, y, x < 0 ? -21 : 21, y < 0 ? -14 : 15, 10.2, 4.3))}
        <path d="M 0 -60 L 38 -31 L 49 -2 L 31 34 L 0 59 L -31 34 L -49 -2 L -38 -31 Z" fill={dark} />
        <path d="M 0 -52 L 29 -27 L 38 -1 L 22 27 L 0 48 L -22 27 L -38 -1 L -29 -27 Z" fill={primary} />
        <path d="M -60 5 L -28 10 L -37 40 L -69 25 Z" fill={dark} stroke={secondary} strokeWidth="1.6" strokeOpacity="0.76" />
        <path d="M 60 5 L 28 10 L 37 40 L 69 25 Z" fill={dark} stroke={secondary} strokeWidth="1.6" strokeOpacity="0.76" />
        <path d="M -49 11 L -30 15 L -35 28 L -55 20 Z" fill={highlight} fillOpacity="0.86" />
        <path d="M 49 11 L 30 15 L 35 28 L 55 20 Z" fill={highlight} fillOpacity="0.86" />
        <path d="M 0 -46 L 15 -19 L 11 7 L 0 20 L -11 7 L -15 -19 Z" fill={secondary} fillOpacity="0.90" />
        <rect x="-18" y="29" width="36" height="10" rx="4" fill={dark} stroke={highlight} strokeWidth="1.6" strokeOpacity="0.86" />
      </g>
    );
  }

  return (
    <g>
      {rotors.map(([x, y]) => armProps(x, y, x < 0 ? -14 : 14, y < 0 ? -9 : 12, 9.8, 4.2))}
      <path d="M 0 -74 L 14 -41 L 38 -17 L 29 3 L 18 43 L 0 62 L -18 43 L -29 3 L -38 -17 L -14 -41 Z" fill={dark} />
      <path d="M 0 -66 L 9 -37 L 30 -15 L 20 4 L 10 35 L 0 51 L -10 35 L -20 4 L -30 -15 L -9 -37 Z" fill={primary} />
      <path d="M -54 -9 L -24 -9 L -17 7 L -53 28 Z" fill={dark} stroke={secondary} strokeWidth="1.65" strokeOpacity="0.78" />
      <path d="M 54 -9 L 24 -9 L 17 7 L 53 28 Z" fill={dark} stroke={secondary} strokeWidth="1.65" strokeOpacity="0.78" />
      <path d="M -43 -5 L -27 -5 L -23 5 L -45 19 Z" fill={highlight} fillOpacity="0.92" />
      <path d="M 43 -5 L 27 -5 L 23 5 L 45 19 Z" fill={highlight} fillOpacity="0.92" />
      <path d="M 0 -56 L 7 -26 L 5 2 L 0 15 L -5 2 L -7 -26 Z" fill={secondary} fillOpacity="0.98" />
      <path d="M 0 22 L 12 38 L 0 49 L -12 38 Z" fill={highlight} fillOpacity="0.88" />
    </g>
  );
}

function StaticPremiumCtfHull({ role, variant, family, primary, secondary, dark, highlight }) {
  const rotors = [[-59, -45], [59, -45], [-59, 45], [59, 45]];
  const arm = (x, y, fromX, fromY, width = 10, accentWidth = 4.8, rotor = 22) => (
    <StaticCtfArm
      key={`${x}-${y}`}
      x={x}
      y={y}
      fromX={fromX}
      fromY={fromY}
      width={width}
      accentWidth={accentWidth}
      primary={primary}
      secondary={secondary}
      dark={dark}
      highlight={highlight}
    />
  );
  const arms = (resolver, width, accent, rotor) =>
    rotors.map(([x, y]) => {
      const [fromX, fromY] = resolver(x, y);
      return arm(x, y, fromX, fromY, width, accent, rotor);
    });

  const Reactor = ({ y = 8, size = 11 }) => (
    <g>
      <path d={`M 0 ${y - size} L ${size * 0.72} ${y - size * 0.20} L ${size * 0.62} ${y + size * 0.68} L 0 ${y + size} L ${-size * 0.62} ${y + size * 0.68} L ${-size * 0.72} ${y - size * 0.20} Z`} fill={dark} stroke={highlight} strokeWidth="1.75" strokeOpacity="0.88" />
      <path d={`M 0 ${y - size * 0.56} L ${size * 0.34} ${y - size * 0.05} L ${size * 0.30} ${y + size * 0.36} L 0 ${y + size * 0.56} L ${-size * 0.30} ${y + size * 0.36} L ${-size * 0.34} ${y - size * 0.05} Z`} fill={secondary} fillOpacity="0.98" />
    </g>
  );

  if (role === "attack-alpha" || role === "attack-bravo") {
    if (family === "galactic") {
      return <g>{arms((x, y) => [x < 0 ? -13 : 13, y < 0 ? -12 : 12], 9.4, 4.3, 21)}
        <path d="M 0 -76 L 13 -45 L 48 -18 L 33 -1 L 20 43 L 0 65 L -20 43 L -33 -1 L -48 -18 L -13 -45 Z" fill={dark} />
        <path d="M 0 -67 L 8 -41 L 38 -16 L 23 1 L 12 36 L 0 53 L -12 36 L -23 1 L -38 -16 L -8 -41 Z" fill={primary} />
        <path d="M -67 -20 L -29 -23 L -19 -6 L -57 22 Z" fill={dark} stroke={secondary} strokeWidth="1.8" strokeOpacity="0.82" />
        <path d="M 67 -20 L 29 -23 L 19 -6 L 57 22 Z" fill={dark} stroke={secondary} strokeWidth="1.8" strokeOpacity="0.82" />
        <path d="M 0 -60 L 7 -33 L 4 -2 L 0 15 L -4 -2 L -7 -33 Z" fill={highlight} fillOpacity="0.98" /><Reactor y={35} size={9} />
      </g>;
    }
    if (family === "medieval") {
      return <g>{arms((x, y) => [x < 0 ? -16 : 16, y < 0 ? -9 : 10], 10.2, 4.5, 22)}
        <path d="M 0 -82 L 15 -49 L 41 -23 L 28 7 L 16 48 L 0 67 L -16 48 L -28 7 L -41 -23 L -15 -49 Z" fill={dark} stroke={secondary} strokeWidth="2.2" strokeOpacity="0.84" />
        <path d="M 0 -69 L 9 -43 L 31 -20 L 18 8 L 9 38 L 0 54 L -9 38 L -18 8 L -31 -20 L -9 -43 Z" fill={primary} />
        <path d="M 0 -92 L 8 -66 L 0 -45 L -8 -66 Z" fill={highlight} />
        <path d="M -63 -6 L -26 -12 L -17 9 L -53 34 Z" fill={dark} stroke={highlight} strokeWidth="1.55" strokeOpacity="0.72" />
        <path d="M 63 -6 L 26 -12 L 17 9 L 53 34 Z" fill={dark} stroke={highlight} strokeWidth="1.55" strokeOpacity="0.72" />
        {[-14,0,14].map((x) => <path key={x} d={`M ${x} 12 L ${x+5} 25 L ${x} 38 L ${x-5} 25 Z`} fill={highlight} fillOpacity="0.90" />)}<Reactor y={26} size={8} />
      </g>;
    }
    if (family === "military") {
      return <g>{arms((x, y) => [x < 0 ? -21 : 21, y < 0 ? -7 : 14], 9.6, 4.25, 21)}
        <path d="M 0 -68 L 38 -43 L 70 -4 L 42 12 L 34 40 L 0 58 L -34 40 L -42 12 L -70 -4 L -38 -43 Z" fill={dark} stroke={secondary} strokeWidth="2.2" strokeOpacity="0.78" />
        <path d="M 0 -56 L 28 -36 L 55 -3 L 31 8 L 24 30 L 0 44 L -24 30 L -31 8 L -55 -3 L -28 -36 Z" fill={primary} />
        <path d="M -76 -15 L -38 -10 L -23 6 L -58 22 Z" fill={dark} stroke={highlight} strokeWidth="1.6" strokeOpacity="0.68" />
        <path d="M 76 -15 L 38 -10 L 23 6 L 58 22 Z" fill={dark} stroke={highlight} strokeWidth="1.6" strokeOpacity="0.68" />
        <path d="M 0 -51 L 12 -25 L 8 8 L 0 20 L -8 8 L -12 -25 Z" fill={secondary} />
        {[-18,0,18].map((x) => <rect key={x} x={x-4} y="28" width="8" height="6" rx="2" fill={highlight} fillOpacity="0.92" />)}
      </g>;
    }
    if (family === "dark-galactic") {
      return <g>{arms((x, y) => [x < 0 ? -14 : 14, y < 0 ? -8 : 11], 9.2, 4.0, 21)}
        <path d="M 0 -77 L 18 -44 L 53 -24 L 34 4 L 19 49 L 0 67 L -19 49 L -34 4 L -53 -24 L -18 -44 Z" fill={dark} stroke={secondary} strokeWidth="2.4" strokeOpacity="0.82" />
        <path d="M 0 -61 L 10 -34 L 37 -20 L 20 5 L 10 36 L 0 52 L -10 36 L -20 5 L -37 -20 L -10 -34 Z" fill={primary} fillOpacity="0.84" />
        <path d="M -89 -31 L -42 -32 L -27 -9 L -72 9 L -95 -7 Z" fill={dark} stroke={secondary} strokeWidth="2" strokeOpacity="0.76" />
        <path d="M 89 -31 L 42 -32 L 27 -9 L 72 9 L 95 -7 Z" fill={dark} stroke={secondary} strokeWidth="2" strokeOpacity="0.76" />
        <path d="M 0 -52 L 7 -21 L 5 14 L 0 29 L -5 14 L -7 -21 Z" fill={highlight} />
      </g>;
    }
    if (family === "abyssal") {
      return <g>{arms((x, y) => [x < 0 ? -17 : 17, y < 0 ? -3 : 16], 9.3, 4.25, 21)}
        <path d="M 0 -72 L 22 -44 L 60 -23 L 73 1 L 42 19 L 22 49 L 0 62 L -22 49 L -42 19 L -73 1 L -60 -23 L -22 -44 Z" fill={dark} stroke={secondary} strokeWidth="2.15" strokeOpacity="0.82" />
        <path d="M 0 -58 L 14 -37 L 47 -19 L 56 0 L 30 12 L 14 37 L 0 49 L -14 37 L -30 12 L -56 0 L -47 -19 L -14 -37 Z" fill={primary} />
        <path d="M -76 8 L -31 -4 L -17 17 L -60 40 Z" fill={dark} stroke={secondary} strokeWidth="1.55" strokeOpacity="0.76" />
        <path d="M 76 8 L 31 -4 L 17 17 L 60 40 Z" fill={dark} stroke={secondary} strokeWidth="1.55" strokeOpacity="0.76" />
        <path d="M -33 -7 L 0 -25 L 33 -7" fill="none" stroke={highlight} strokeWidth="2.2" strokeOpacity="0.72" /><Reactor y={18} size={10} />
      </g>;
    }
    if (family === "solar") {
      return <g>{arms((x, y) => [x < 0 ? -15 : 15, y < 0 ? -10 : 13], 9.5, 4.4, 21)}
        <path d="M 0 -88 L 13 -53 L 44 -25 L 28 4 L 17 45 L 0 69 L -17 45 L -28 4 L -44 -25 L -13 -53 Z" fill={dark} stroke={secondary} strokeWidth="2.1" strokeOpacity="0.84" />
        <path d="M 0 -74 L 8 -47 L 32 -22 L 17 5 L 9 37 L 0 56 L -9 37 L -17 5 L -32 -22 L -8 -47 Z" fill={primary} />
        <path d="M 0 -102 L 9 -78 L 0 -56 L -9 -78 Z" fill={highlight} />
        <path d="M -66 -19 L -33 -13 L -47 10 L -77 4 Z" fill={dark} stroke={secondary} strokeWidth="1.6" strokeOpacity="0.78" />
        <path d="M 66 -19 L 33 -13 L 47 10 L 77 4 Z" fill={dark} stroke={secondary} strokeWidth="1.6" strokeOpacity="0.78" />
        <circle cx="0" cy="9" r="14" fill={highlight} fillOpacity="0.86" /><circle cx="0" cy="9" r="8" fill={secondary} />
      </g>;
    }
    return <g>{arms((x, y) => [x < 0 ? -16 : 16, y < 0 ? -7 : 13], 9.6, 4.3, 21)}
      <path d="M 0 -80 L 18 -48 L 49 -21 L 31 3 L 18 48 L 0 69 L -18 48 L -31 3 L -49 -21 L -18 -48 Z" fill={dark} stroke={secondary} strokeWidth="2.2" strokeOpacity="0.84" />
      <path d="M 0 -67 L 11 -41 L 36 -18 L 20 5 L 10 39 L 0 56 L -10 39 L -20 5 L -36 -18 L -11 -41 Z" fill={primary} />
      <path d="M -70 -31 L -25 -8 L -61 27" fill="none" stroke={highlight} strokeWidth="4.2" strokeLinecap="round" strokeOpacity="0.86" />
      <path d="M 70 -31 L 25 -8 L 61 27" fill="none" stroke={highlight} strokeWidth="4.2" strokeLinecap="round" strokeOpacity="0.86" />
      <path d="M 0 -55 L 8 -23 L 5 11 L 0 26 L -5 11 L -8 -23 Z" fill={secondary} /><path d="M -28 39 L 0 54 L 28 39" fill="none" stroke={highlight} strokeWidth="3.4" strokeOpacity="0.72" />
    </g>;
  }

  if (role === "tank") {
    if (family === "galactic") return <g>{arms((x,y)=>[x<0?-32:32,y<0?-18:22],15.4,6.8,26)}
      <path d="M 0 -62 L 48 -43 L 69 -8 L 57 33 L 30 63 L 0 74 L -30 63 L -57 33 L -69 -8 L -48 -43 Z" fill={dark} stroke={secondary} strokeWidth="2.7" strokeOpacity="0.84" />
      <path d="M 0 -52 L 39 -36 L 57 -7 L 46 26 L 23 52 L 0 62 L -23 52 L -46 26 L -57 -7 L -39 -36 Z" fill={primary} />
      <path d="M -77 -16 L -41 -18 L -32 34 L -68 45 Z" fill={dark} stroke={secondary} strokeWidth="2" strokeOpacity="0.76" /><path d="M 77 -16 L 41 -18 L 32 34 L 68 45 Z" fill={dark} stroke={secondary} strokeWidth="2" strokeOpacity="0.76" />
      <rect x="-33" y="-34" width="66" height="15" rx="7" fill={dark} stroke={highlight} strokeWidth="1.4" strokeOpacity="0.72" />{[-22,-7,7,22].map(x=><rect key={x} x={x-4} y="-29" width="8" height="5" rx="2" fill={highlight} fillOpacity="0.92" />)}<Reactor y={16} size={13} />
    </g>;
    if (family === "medieval") return <g>{arms((x,y)=>[x<0?-34:34,y<0?-17:22],15.8,7,27)}
      <path d="M 0 -73 L 34 -59 L 61 -29 L 67 13 L 48 50 L 20 70 L -20 70 L -48 50 L -67 13 L -61 -29 L -34 -59 Z" fill={dark} stroke={secondary} strokeWidth="3" strokeOpacity="0.86" />
      <path d="M 0 -59 L 26 -50 L 48 -25 L 54 11 L 38 40 L 15 57 L -15 57 L -38 40 L -54 11 L -48 -25 L -26 -50 Z" fill={primary} />
      <path d="M 0 -50 L 18 -27 L 25 8 L 14 39 L 0 51 L -14 39 L -25 8 L -18 -27 Z" fill={dark} stroke={highlight} strokeWidth="2.1" strokeOpacity="0.78" />
      <path d="M -58 -5 L -80 6 L -57 45 L -44 30 Z" fill={dark} stroke={highlight} strokeWidth="1.7" strokeOpacity="0.70" /><path d="M 58 -5 L 80 6 L 57 45 L 44 30 Z" fill={dark} stroke={highlight} strokeWidth="1.7" strokeOpacity="0.70" /><circle cx="0" cy="4" r="12" fill={secondary} fillOpacity="0.90" />
    </g>;
    if (family === "military") return <g>{arms((x,y)=>[x<0?-39:39,y<0?-16:21],16.6,7.2,27)}
      <path d="M -75 -37 L -24 -56 L 24 -56 L 75 -37 L 82 10 L 56 49 L 23 64 L -23 64 L -56 49 L -82 10 Z" fill={dark} stroke={secondary} strokeWidth="2.6" strokeOpacity="0.84" />
      <path d="M -61 -30 L -20 -45 L 20 -45 L 61 -30 L 66 7 L 43 36 L 18 50 L -18 50 L -43 36 L -66 7 Z" fill={primary} />
      <rect x="-44" y="-29" width="88" height="19" rx="6" fill={dark} stroke={highlight} strokeWidth="1.6" strokeOpacity="0.76" />{[-29,-10,10,29].map(x=><rect key={x} x={x-5} y="-23" width="10" height="6" rx="2" fill={highlight} fillOpacity="0.95" />)}<Reactor y={20} size={12} />
    </g>;
    if (family === "dark-galactic") return <g>{arms((x,y)=>[x<0?-34:34,y<0?-18:21],15.6,6.7,26)}
      <path d="M 0 -68 L 48 -46 L 77 -15 L 61 29 L 30 67 L 0 79 L -30 67 L -61 29 L -77 -15 L -48 -46 Z" fill={dark} stroke={secondary} strokeWidth="2.9" strokeOpacity="0.84" />
      <path d="M 0 -54 L 36 -37 L 60 -12 L 46 24 L 21 54 L 0 65 L -21 54 L -46 24 L -60 -12 L -36 -37 Z" fill={primary} fillOpacity="0.78" />
      <path d="M -90 -30 L -42 -36 L -25 2 L -69 28 L -94 5 Z" fill={dark} stroke={secondary} strokeWidth="2.2" strokeOpacity="0.75" /><path d="M 90 -30 L 42 -36 L 25 2 L 69 28 L 94 5 Z" fill={dark} stroke={secondary} strokeWidth="2.2" strokeOpacity="0.75" /><Reactor y={17} size={13} />
    </g>;
    if (family === "abyssal") return <g>{arms((x,y)=>[x<0?-36:36,y<0?-18:22],15.7,6.9,26)}
      <path d="M 0 -65 L 51 -43 L 76 -8 L 66 28 L 42 58 L 0 73 L -42 58 L -66 28 L -76 -8 L -51 -43 Z" fill={dark} stroke={secondary} strokeWidth="2.8" strokeOpacity="0.82" />
      <path d="M 0 -51 L 40 -34 L 60 -6 L 51 23 L 31 47 L 0 60 L -31 47 L -51 23 L -60 -6 L -40 -34 Z" fill={primary} />
      <path d="M -72 -13 L -43 -9 L -31 36 L -69 46 Z" fill={dark} stroke={secondary} strokeWidth="1.9" strokeOpacity="0.76" /><path d="M 72 -13 L 43 -9 L 31 36 L 69 46 Z" fill={dark} stroke={secondary} strokeWidth="1.9" strokeOpacity="0.76" /><path d="M -35 -24 L 0 -44 L 35 -24" fill="none" stroke={highlight} strokeWidth="2.4" strokeOpacity="0.72" /><Reactor y={11} size={12} />
    </g>;
    if (family === "solar") return <g>{arms((x,y)=>[x<0?-35:35,y<0?-17:22],15.5,6.8,26)}
      <path d="M 0 -72 L 43 -52 L 72 -16 L 63 23 L 35 61 L 0 76 L -35 61 L -63 23 L -72 -16 L -43 -52 Z" fill={dark} stroke={secondary} strokeWidth="2.8" strokeOpacity="0.84" />
      <path d="M 0 -58 L 33 -43 L 56 -13 L 49 18 L 27 49 L 0 63 L -27 49 L -49 18 L -56 -13 L -33 -43 Z" fill={primary} />
      <path d="M 0 -82 L 14 -57 L 0 -37 L -14 -57 Z" fill={highlight} /><circle cx="0" cy="6" r="16" fill={highlight} fillOpacity="0.86" /><circle cx="0" cy="6" r="9" fill={secondary} />
    </g>;
    return <g>{arms((x,y)=>[x<0?-37:37,y<0?-17:22],16,6.9,26)}
      <path d="M 0 -74 L 44 -53 L 75 -19 L 66 24 L 39 62 L 0 77 L -39 62 L -66 24 L -75 -19 L -44 -53 Z" fill={dark} stroke={secondary} strokeWidth="2.9" strokeOpacity="0.86" />
      <path d="M 0 -60 L 34 -44 L 59 -16 L 51 19 L 28 50 L 0 64 L -28 50 L -51 19 L -59 -16 L -34 -44 Z" fill={primary} />
      <path d="M 0 -86 L 17 -61 L 0 -42 L -17 -61 Z" fill={highlight} /><path d="M -78 -20 L -45 -11 L -34 33 L -72 48 Z" fill={dark} stroke={highlight} strokeWidth="1.65" strokeOpacity="0.72" /><path d="M 78 -20 L 45 -11 L 34 33 L 72 48 Z" fill={dark} stroke={highlight} strokeWidth="1.65" strokeOpacity="0.72" /><Reactor y={17} size={13} />
    </g>;
  }

  if (family === "galactic") return <g>{arms((x,y)=>[x<0?-22:22,y<0?-20:20],12.2,5.4,23)}
    <path d="M 0 -70 L 43 -45 L 62 -3 L 48 39 L 20 67 L -20 67 L -48 39 L -62 -3 L -43 -45 Z" fill={dark} stroke={secondary} strokeWidth="2.5" strokeOpacity="0.84" /><path d="M 0 -58 L 34 -37 L 49 -2 L 37 29 L 15 53 L -15 53 L -37 29 L -49 -2 L -34 -37 Z" fill={primary} /><circle cx="0" cy="2" r="39" fill="none" stroke={highlight} strokeWidth="3.5" strokeOpacity="0.82" /><circle cx="0" cy="2" r="27" fill="none" stroke={secondary} strokeWidth="2" strokeOpacity="0.64" /><Reactor y={1} size={10} />
  </g>;
  if (family === "medieval") return <g>{arms((x,y)=>[x<0?-21:21,y<0?-21:20],12.8,5.6,24)}
    <path d="M 0 -77 L 39 -52 L 62 -14 L 51 30 L 24 65 L -24 65 L -51 30 L -62 -14 L -39 -52 Z" fill={dark} stroke={secondary} strokeWidth="2.8" strokeOpacity="0.86" /><path d="M 0 -64 L 30 -44 L 49 -12 L 39 23 L 18 52 L -18 52 L -39 23 L -49 -12 L -30 -44 Z" fill={primary} /><path d="M 0 -51 L 18 -27 L 27 0 L 16 30 L 0 47 L -16 30 L -27 0 L -18 -27 Z" fill={dark} stroke={highlight} strokeWidth="2.2" strokeOpacity="0.82" /><Reactor y={0} size={10} />
  </g>;
  if (family === "military") return <g>{arms((x,y)=>[x<0?-23:23,y<0?-20:19],12.8,5.6,24)}
    <path d="M -65 -45 L -16 -64 L 16 -64 L 65 -45 L 72 0 L 50 48 L 18 65 L -18 65 L -50 48 L -72 0 Z" fill={dark} stroke={secondary} strokeWidth="2.5" strokeOpacity="0.82" /><path d="M -51 -37 L -13 -51 L 13 -51 L 51 -37 L 57 0 L 38 36 L 14 51 L -14 51 L -38 36 L -57 0 Z" fill={primary} /><rect x="-56" y="-18" width="17" height="50" rx="6" fill={dark} stroke={highlight} strokeWidth="1.55" strokeOpacity="0.72" /><rect x="39" y="-18" width="17" height="50" rx="6" fill={dark} stroke={highlight} strokeWidth="1.55" strokeOpacity="0.72" /><Reactor y={2} size={10} />
  </g>;
  if (family === "dark-galactic") return <g>{arms((x,y)=>[x<0?-21:21,y<0?-20:20],12.4,5.5,23)}
    <path d="M 0 -76 L 45 -49 L 68 -8 L 49 38 L 21 70 L -21 70 L -49 38 L -68 -8 L -45 -49 Z" fill={dark} stroke={secondary} strokeWidth="2.7" strokeOpacity="0.84" /><path d="M 0 -60 L 34 -40 L 54 -7 L 38 30 L 15 56 L -15 56 L -38 30 L -54 -7 L -34 -40 Z" fill={primary} fillOpacity="0.78" /><path d="M -82 -23 L -42 -20 L -29 12 L -68 32 Z" fill={dark} stroke={secondary} strokeWidth="1.9" strokeOpacity="0.76" /><path d="M 82 -23 L 42 -20 L 29 12 L 68 32 Z" fill={dark} stroke={secondary} strokeWidth="1.9" strokeOpacity="0.76" /><Reactor y={2} size={10} />
  </g>;
  if (family === "abyssal") return <g>{arms((x,y)=>[x<0?-22:22,y<0?-20:20],12.4,5.4,23)}
    <path d="M 0 -72 L 46 -42 L 69 -1 L 50 40 L 20 67 L -20 67 L -50 40 L -69 -1 L -46 -42 Z" fill={dark} stroke={secondary} strokeWidth="2.7" strokeOpacity="0.84" /><path d="M 0 -59 L 36 -35 L 55 -1 L 39 31 L 15 54 L -15 54 L -39 31 L -55 -1 L -36 -35 Z" fill={primary} /><path d="M -54 -9 L -73 13 L -47 38" fill="none" stroke={highlight} strokeWidth="4" strokeLinecap="round" strokeOpacity="0.78" /><path d="M 54 -9 L 73 13 L 47 38" fill="none" stroke={highlight} strokeWidth="4" strokeLinecap="round" strokeOpacity="0.78" /><Reactor y={3} size={10} />
  </g>;
  if (family === "solar") return <g>{arms((x,y)=>[x<0?-22:22,y<0?-20:20],12.5,5.5,23)}
    <path d="M 0 -80 L 43 -53 L 68 -12 L 52 34 L 21 70 L -21 70 L -52 34 L -68 -12 L -43 -53 Z" fill={dark} stroke={secondary} strokeWidth="2.8" strokeOpacity="0.84" /><path d="M 0 -66 L 33 -44 L 54 -10 L 40 27 L 16 57 L -16 57 L -40 27 L -54 -10 L -33 -44 Z" fill={primary} /><circle cx="0" cy="0" r="42" fill="none" stroke={highlight} strokeWidth="4" strokeOpacity="0.86" /><circle cx="0" cy="0" r="29" fill="none" stroke={secondary} strokeWidth="2.1" strokeOpacity="0.76" /><Reactor y={1} size={10} />
  </g>;
  return <g>{arms((x,y)=>[x<0?-22:22,y<0?-20:20],12.7,5.6,24)}
    <path d="M 0 -78 L 44 -51 L 69 -9 L 53 38 L 21 69 L -21 69 L -53 38 L -69 -9 L -44 -51 Z" fill={dark} stroke={secondary} strokeWidth="2.8" strokeOpacity="0.86" /><path d="M 0 -65 L 34 -42 L 55 -8 L 41 30 L 16 56 L -16 56 L -41 30 L -55 -8 L -34 -42 Z" fill={primary} /><path d="M -62 -34 L 62 -34" fill="none" stroke={highlight} strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.86" /><path d="M -51 -34 L -51 27" fill="none" stroke={highlight} strokeWidth="4.2" strokeLinecap="round" strokeOpacity="0.80" /><path d="M 51 -34 L 51 27" fill="none" stroke={highlight} strokeWidth="4.2" strokeLinecap="round" strokeOpacity="0.80" /><Reactor y={3} size={9} />
  </g>;
}

function StaticArenaDroneHull({ primary, secondary, dark, highlight }) {
  const rotors = [[-59, -45], [59, -45], [-59, 45], [59, 45]];
  return (
    <g>
      {rotors.map(([x, y]) => (
        <StaticCtfArm
          key={`${x}-${y}`}
          x={x}
          y={y}
          fromX={x < 0 ? -21 : 21}
          fromY={y < 0 ? -17 : 17}
          width={12}
          accentWidth={6.4}
          primary={primary}
          secondary={secondary}
          dark={dark}
          highlight={highlight}
        />
      ))}
      <path d="M 0 -52 L 23 -39 L 34 -8 L 30 24 L 17 47 L 0 56 L -17 47 L -30 24 L -34 -8 L -23 -39 Z" fill={dark} />
      <path d="M 0 -47 L 17 -34 L 25 -7 L 22 21 L 12 40 L 0 47 L -12 40 L -22 21 L -25 -7 L -17 -34 Z" fill={primary} />
      <path d="M 0 -41 L 7 -26 L 9 12 L 4 34 L 0 39 L -4 34 L -9 12 L -7 -26 Z" fill={dark} fillOpacity="0.55" />
      <path d="M 0 -42 L 12 -29 L 11 -10 L 0 -2 L -11 -10 L -12 -29 Z" fill={secondary} fillOpacity="0.56" />
      <path d="M 0 -38 L 6 -29 L 5 -17 L 0 -13 L -5 -17 L -6 -29 Z" fill={highlight} fillOpacity="0.72" />
      <rect x="-24" y="8" width="8" height="18" rx="3" fill={dark} fillOpacity="0.88" />
      <rect x="16" y="8" width="8" height="18" rx="3" fill={dark} fillOpacity="0.88" />
      <rect x="-22" y="10" width="4" height="12" rx="2" fill={secondary} fillOpacity="0.45" />
      <rect x="18" y="10" width="4" height="12" rx="2" fill={secondary} fillOpacity="0.45" />
      <rect x="-8" y="29" width="16" height="13" rx="5" fill={dark} />
      <rect x="-5" y="32" width="10" height="7" rx="3" fill={highlight} fillOpacity="0.90" />
      <path d="M 0 -47 L 17 -34 L 25 -7 L 22 21 L 12 40 L 0 47 L -12 40 L -22 21 L -25 -7 L -17 -34 Z" fill="none" stroke={highlight} strokeWidth="1.7" strokeOpacity="0.38" />
    </g>
  );
}

function StaticDronePreview({ skin = BASIC_DRONE, drone, size = "large", compact = false, label = "" }) {
  const item = drone || skin || BASIC_DRONE;
  const [primary, secondary, dark, highlight] = getPreviewColors(item);
  const meta = getCtfVisualMeta(item);
  const className = `static-drone-preview static-drone-preview-${size} ${compact ? "is-compact" : ""} ${meta.isCtf ? "is-ctf" : ""}`;
  const title = item?.name || SKIN_NAMES[item?.id] || "Drone";

  return (
    <div className={className} aria-label={`${title} static preview`} title={title}>
      <svg viewBox="-130 -130 260 260" role="img" aria-hidden="true">
        <circle cx="0" cy="0" r="105" fill="none" stroke={primary} strokeOpacity="0.22" strokeWidth="2" />
        <circle cx="0" cy="0" r="85" fill={dark} fillOpacity="0.20" stroke={secondary} strokeOpacity="0.23" strokeWidth="1.2" />
        {meta.isCtf ? (
          meta.family === "starter" ? (
            <StaticStarterCommandHull role={meta.role} primary={primary} secondary={secondary} dark={dark} highlight={highlight} />
          ) : (
            <StaticPremiumCtfHull
              role={meta.role}
              variant={meta.variant}
              family={meta.family}
              primary={primary}
              secondary={secondary}
              dark={dark}
              highlight={highlight}
            />
          )
        ) : (
          <StaticArenaDroneHull primary={primary} secondary={secondary} dark={dark} highlight={highlight} />
        )}
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
