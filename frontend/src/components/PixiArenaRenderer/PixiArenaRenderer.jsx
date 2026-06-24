import { useEffect, useMemo, useRef } from "react";
import * as PIXI from "pixi.js";
import "./PixiArenaRenderer.css";

const SKIN_THEMES = {
  cyan: ["#00eaff", "#78f7ff", "#003140", "#ffffff"],
  red: ["#ff4040", "#ff9a9a", "#380000", "#ffffff"],
  purple: ["#9b5cff", "#d5b6ff", "#180034", "#ffffff"],
  orange: ["#ff9f1c", "#ffd166", "#4b2100", "#fff7e6"],
  green: ["#19ff8a", "#8cffc4", "#00391f", "#ffffff"],
  pink: ["#ff4fd8", "#ffb8ef", "#4d003c", "#ffffff"],
  "ice-blue": ["#7de7ff", "#e7fbff", "#07314a", "#ffffff"],
  "solar-gold": ["#ffd447", "#fff0a8", "#513a00", "#ffffff"],
  "shadow-black": ["#2e3440", "#6b7280", "#05070c", "#bdeeff"],
  "toxic-lime": ["#b6ff00", "#e8ff8a", "#284000", "#ffffff"],
  "royal-violet": ["#6d28d9", "#c4b5fd", "#14002e", "#f8f5ff"],
  "crimson-white": ["#dc143c", "#ffffff", "#43000d", "#fff5f7"],
  "neon-teal": ["#00ffcc", "#a7ffee", "#003c33", "#ffffff"],
  "ember-red": ["#ff5a1f", "#ffb86b", "#451100", "#fff0e6"],
  "arctic-silver": ["#c7d2fe", "#f8fafc", "#1e293b", "#ffffff"],
  "void-purple": ["#4c1d95", "#a78bfa", "#070012", "#e9d5ff"],
  "plasma-pink": ["#ff00aa", "#ff7adf", "#3f0030", "#ffffff"],
  "jade-black": ["#00a86b", "#86efac", "#001e14", "#eafff5"],
  "azure-white": ["#38bdf8", "#ffffff", "#082f49", "#ffffff"],
  "inferno-orange": ["#ff6b00", "#ffcf33", "#4a1300", "#fff4df"],
  "midnight-blue": ["#1e3a8a", "#60a5fa", "#020617", "#dbeafe"],
  "acid-green": ["#39ff14", "#c6ff8a", "#0f2b00", "#ffffff"],
  "ruby-black": ["#e11d48", "#fb7185", "#09090b", "#ffe4e6"],
  "ghost-white": ["#e5e7eb", "#ffffff", "#334155", "#ffffff"],
  "cyber-yellow": ["#faff00", "#fff7ad", "#3a3800", "#ffffff"],
  "deep-ocean": ["#006994", "#67e8f9", "#001b2e", "#e0ffff"],
  "magenta-cyan": ["#ff00ff", "#00ffff", "#250033", "#ffffff"],
  "bronze-steel": ["#b87333", "#d1d5db", "#2b1605", "#fff7ed"],
  "electric-indigo": ["#4f46e5", "#93c5fd", "#0b102f", "#eef2ff"],
  "dark-emerald": ["#047857", "#34d399", "#001f16", "#d1fae5"],
};

const STANDARD_DRONE_SIZE = 118;
const STANDARD_DRONE_MIN_SIZE = 82;

const ORB_COLORS = {
  cyan: 0x00eaff,
  green: 0x7cff2e,
  orange: 0xff9d00,
  purple: 0xa855ff,
  red: 0xff4040,
  pink: 0xff4fc3,
};

const MOBILE_PERF_PROFILES = {
  LOW: "low",
  MID: "mid",
  HIGH: "high",
};

// ---------------------------------------------------------------------------
// IMPORTANT: device-urile vechi (Huawei P20/P30/Mate, telefoane Android cu
// Adreno/Mali low-end) au GPU mult mai slab la alpha blending/glow-uri si CPU
// mult mai lent decat un iPhone modern. Pana acum, tier-ul LOW reducea doar
// ---------------------------------------------------------------------------
// IMPORTANT - corectie fata de versiunea anterioara: NU mai plafonam ticker-ul
// Pixi la un FPS target fix (ex 30) pe device slab. Bucla de joc (in
// PvpArena.jsx/NormalPvpArena.jsx) ruleaza separat, prin requestAnimationFrame,
// care pe orice telefon avanseaza la rata nativa a ecranului (de regula 60Hz,
// legata de vsync, indiferent cat de lent e CPU-ul). Daca plafonam Pixi la
// 30fps, randarea citeste pixiLiveRef doar o data la ~33ms, in timp ce datele
// se actualizeaza de doua ori mai des (60Hz) - rezultatul vizual e EXACT
// senzatia de "sacadat/in trepte" reclamata, pentru ca pozitia "salta" intre
// valori in pasi mari la fiecare desenare, in loc sa avanseze fin.
// Solutia corecta: lasam Pixi sa deseneze cat de des poate device-ul (browser-ul
// decide natural, in functie de cat de ieftin e fiecare frame), fara plafon
// artificial. Pe device foarte slab, randarea va ajunge organic la framerate-ul
// pe care GPU-ul il poate sustine, dar fara mismatch fata de rAF-ul de joc.
// ---------------------------------------------------------------------------

function getDeviceProfile() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isMobile: false,
      isPhonePortrait: false,
      isLowEndMobile: false,
      isVeryLowEndMobile: false,
      isWeakDesktop: false,
      tier: MOBILE_PERF_PROFILES.HIGH,
      dpr: 1,
      resolution: 1,
    };
  }

  const ua = navigator.userAgent || "";
  const isPhoneUa = /Android.*Mobile|iPhone|iPod|IEMobile|Opera Mini/i.test(ua);
  const isHuaweiLike = /Huawei|HONOR|HUAWEI|VOG-|ANA-|ELS-|LYA-|MAR-|PRA-|CLT-|ANE-|FIG-/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const longSide = Math.max(window.innerWidth, window.innerHeight);
  const isMobile = Boolean(isPhoneUa && hasTouch && shortSide <= 980 && longSide <= 2800);
  const isPhonePortrait = Boolean(isMobile && window.innerHeight >= window.innerWidth);

  const cores = Number(navigator.hardwareConcurrency || 4);
  const dpr = Math.max(1, Number(window.devicePixelRatio || 1));

  // navigator.deviceMemory nu exista in Safari/Firefox (desktop sau mobil) -
  // in acel caz reportedMemory ramane null, ca sa NU presupunem fals ca un
  // device e slab doar pentru ca browserul respectiv nu raporteaza memoria.
  // Doar pe Chrome/Edge (unde API-ul exista) folosim efectiv valoarea.
  const reportedMemory = typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : null;
  const memory = reportedMemory ?? 4;

  const isLowEndMobile = Boolean(
    isMobile &&
      (isHuaweiLike || cores <= 4 || memory <= 4 || dpr >= 3)
  );

  // Foarte slab: device vechi cu putine nuclee SI memorie mica, sau orice
  // device Huawei-like detectat (acolo GPU-ul e aproape sigur mult mai slab
  // la WebGL alpha blending, indiferent de cores/memory raportate).
  const isVeryLowEndMobile = Boolean(
    isMobile &&
      (isHuaweiLike || (cores <= 4 && memory <= 3))
  );

  // ---------------------------------------------------------------------
  // IMPORTANT: laptop/PC slab (NU mobil) - acelasi criteriu pe care l-am
  // aplicat in BattleRoyale.jsx pentru bucla de AI: RAM <= 8GB SAU <= 4
  // nuclee CPU (oricare conditie e suficienta). Inainte de aceasta adaugare,
  // niciun desktop/laptop nu era marcat vreodata ca "slab" aici (toate
  // verificarile de mai sus erau conditionate de isMobile), motiv pentru
  // care dezactivarea animatiilor de rotire nu se aplica niciodata pe PC -
  // doar pe telefon.
  // ---------------------------------------------------------------------
  const isWeakDesktop = Boolean(
    !isMobile &&
      (cores <= 4 || (reportedMemory !== null && reportedMemory <= 8))
  );

  const tier = !isMobile
    ? (isWeakDesktop ? MOBILE_PERF_PROFILES.MID : MOBILE_PERF_PROFILES.HIGH)
    : isLowEndMobile
      ? MOBILE_PERF_PROFILES.LOW
      : MOBILE_PERF_PROFILES.MID;

  const resolution = !isMobile
    ? Math.min(dpr, 2)
    : isVeryLowEndMobile
      ? 1 // pe device foarte slab, randam la rezolutie nativa CSS, fara supersampling
      : isLowEndMobile
        ? Math.min(dpr, 1.25)
        : Math.min(dpr, 1.5);

  return {
    isMobile,
    isPhonePortrait,
    isLowEndMobile,
    isVeryLowEndMobile,
    isWeakDesktop,
    tier,
    dpr,
    resolution,
  };
}

function getQualityBudget(device, dynamicQuality = 2) {
  const tier = device?.tier || MOBILE_PERF_PROFILES.HIGH;
  const q = Math.max(0, Math.min(3, dynamicQuality));
  // Pe device foarte slab, dezactivam complet glow-urile (cel mai scump efect
  // vizual per obiect pe GPU-uri vechi) si fortam drawLiteItems pentru toate
  // tipurile de obiecte, nu doar orbs/energy.
  const disableGlow = Boolean(device?.isVeryLowEndMobile);

  // ---------------------------------------------------------------------
  // IMPORTANT: pe laptop/PC slab (isWeakDesktop), problema raportata nu e
  // costul global de a avea 70 de boti pe harta - e costul de a randa la
  // CALITATE COMPLETA mai multi boti deodata cand se aglomereaza langa
  // jucator (lupte/coliziuni in grup). Pe tier HIGH normal, pana la 24 de
  // boti pot fi randati la calitate completa simultan (cu glow, rotoare,
  // mini-drone orbitale) - prea mult pentru un CPU/GPU slab cand se intampla
  // efectiv. Reducem agresiv DOAR limita de boti/players la calitate maxima,
  // fara sa retrogradam tot tier-ul la LOW (care ar afecta si orbs/energy/
  // cores, lucruri pe care utilizatorul nu vrea reduse).
  // ---------------------------------------------------------------------
  if (device?.isWeakDesktop && tier !== MOBILE_PERF_PROFILES.LOW) {
    const baseBudget = q <= 1
      ? {
          quality: 1,
          margin: 320,
          orbs: 260,
          energy: 60,
          cores: 10,
          players: 24,
          bots: 12,
          simpleBots: 20,
          projectiles: 80,
          simpleProjectiles: 35,
          botQuality: 1,
          playerQuality: 2,
          drawLiteItems: false,
          disableGlow: false,
        }
      : {
          quality: 2,
          margin: 420,
          orbs: 420,
          energy: 100,
          cores: 16,
          players: 48,
          bots: 24,
          simpleBots: 45,
          projectiles: 130,
          simpleProjectiles: 70,
          botQuality: 1,
          playerQuality: 2,
          drawLiteItems: false,
          disableGlow: false,
        };

    return {
      ...baseBudget,
      // Limita boti/players la calitate completa: 7 in loc de 12-24.
      // simpleBots (randati ca puncte simple, fara rotoare/glow) preiau
      // restul - botii rimasi vizibili dar nu mai costa la fel de mult.
      bots: 7,
      players: 7,
      simpleBots: Math.max(baseBudget.simpleBots, 38),
      // Pe device slab, botii apropiati (deja la quality 1, nu 2) - reducem
      // si raza la care un bot e considerat "near" implicit prin botQuality.
      botQuality: q <= 1 ? 0 : 1,
    };
  }

  if (tier === MOBILE_PERF_PROFILES.LOW) {
    return q <= 0
      ? {
          quality: 0,
          margin: 170,
          orbs: 90,
          energy: 20,
          cores: 4,
          players: 4,
          bots: 3,
          simpleBots: 0,
          projectiles: 14,
          simpleProjectiles: 5,
          botQuality: 0,
          playerQuality: disableGlow ? 0 : 1,
          drawLiteItems: true,
          disableGlow,
        }
      : {
          quality: 0,
          margin: 200,
          orbs: 120,
          energy: 22,
          cores: 5,
          players: 5,
          bots: 4,
          simpleBots: 0,
          projectiles: 22,
          simpleProjectiles: 8,
          botQuality: 0,
          playerQuality: disableGlow ? 0 : 1,
          drawLiteItems: true,
          disableGlow,
        };
  }

  if (tier === MOBILE_PERF_PROFILES.MID) {
    return q <= 1
      ? {
          quality: 1,
          margin: 260,
          orbs: 180,
          energy: 34,
          cores: 6,
          players: 8,
          bots: 7,
          simpleBots: 0,
          projectiles: 40,
          simpleProjectiles: 16,
          botQuality: 0,
          playerQuality: 2,
          drawLiteItems: false,
          disableGlow: false,
        }
      : {
          quality: 1,
          margin: 320,
          orbs: 250,
          energy: 52,
          cores: 8,
          players: 12,
          bots: 10,
          simpleBots: 0,
          projectiles: 58,
          simpleProjectiles: 24,
          botQuality: 1,
          playerQuality: 2,
          drawLiteItems: false,
          disableGlow: false,
        };
  }

  return q <= 1
    ? {
        quality: 1,
        margin: 320,
        orbs: 260,
        energy: 60,
        cores: 10,
        players: 24,
        bots: 12,
        simpleBots: 20,
        projectiles: 80,
        simpleProjectiles: 35,
        botQuality: 1,
        playerQuality: 2,
        drawLiteItems: false,
        disableGlow: false,
      }
    : {
        quality: 2,
        margin: 420,
        orbs: 420,
        energy: 100,
        cores: 16,
        players: 48,
        bots: 24,
        simpleBots: 45,
        projectiles: 130,
        simpleProjectiles: 70,
        botQuality: 1,
        playerQuality: 2,
        drawLiteItems: false,
        disableGlow: false,
      };
}

function drawOrbLite(g, orb, cameraX, cameraY, scale, vw, vh) {
  const p = screen(orb.x, orb.y, cameraX, cameraY, scale);
  if (p.x < -60 || p.y < -60 || p.x > vw + 60 || p.y > vh + 60) return;

  const color = ORB_COLORS[orb.color] || ORB_COLORS.cyan;
  const r = Math.max(7, 10.5 * scale);

  g.circle(p.x, p.y, r).fill({ color, alpha: 0.94 });
  g.circle(p.x - r * 0.25, p.y - r * 0.28, r * 0.22).fill({
    color: 0xffffff,
    alpha: 0.42,
  });
}

function drawEnergyLite(g, cell, cameraX, cameraY, scale, vw, vh) {
  const p = screen(cell.x, cell.y, cameraX, cameraY, scale);
  if (p.x < -70 || p.y < -70 || p.x > vw + 70 || p.y > vh + 70) return;

  const r = Math.max(11, 16 * scale);
  g.roundRect(p.x - r * 0.45, p.y - r * 0.62, r * 0.9, r * 1.24, r * 0.24).fill({
    color: 0x06351f,
    alpha: 0.92,
  });
  g.roundRect(p.x - r * 0.32, p.y - r * 0.44, r * 0.64, r * 0.88, r * 0.18).fill({
    color: 0x67ffb1,
    alpha: 0.92,
  });
}

function normalizeSkin(skin) {
  const value = String(skin || "cyan")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  if (!value || value === "basic" || value === "basic-drone") return "cyan";
  return SKIN_THEMES[value] ? value : "cyan";
}

function hex(value) {
  if (typeof value === "number") return value;
  return Number.parseInt(String(value || "#ffffff").replace("#", "").slice(0, 6), 16);
}

function mixColor(a, b, amount = 0.5) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;

  return (
    (Math.round(ar + (br - ar) * amount) << 16) +
    (Math.round(ag + (bg - ag) * amount) << 8) +
    Math.round(ab + (bb - ab) * amount)
  );
}

function screen(x, y, cameraX, cameraY, scale) {
  return {
    x: x * scale + cameraX,
    y: y * scale + cameraY,
  };
}

function getWorldViewBounds(cameraX, cameraY, scale, viewportWidth, viewportHeight, margin = 360) {
  const safeScale = scale || 1;

  return {
    left: (-cameraX - margin) / safeScale,
    right: (viewportWidth - cameraX + margin) / safeScale,
    top: (-cameraY - margin) / safeScale,
    bottom: (viewportHeight - cameraY + margin) / safeScale,
  };
}

function isWorldVisible(item, bounds, radius = 0) {
  if (!item) return false;

  return (
    item.x + radius >= bounds.left &&
    item.x - radius <= bounds.right &&
    item.y + radius >= bounds.top &&
    item.y - radius <= bounds.bottom
  );
}

function filterVisibleItems(items = [], bounds, radius, limit = Infinity) {
  const result = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (isWorldVisible(item, bounds, radius)) {
      result.push(item);

      if (result.length >= limit) break;
    }
  }

  return result;
}

function hasActiveShield(unit) {
  return Boolean(
    unit?.shieldActive ||
      unit?.isShieldActive ||
      unit?.shield ||
      unit?.shielded ||
      unit?.defending ||
      unit?.rightClickShieldActive
  );
}

function glow(g, x, y, r, color, power = 1, quality = 1, disableGlow = false) {
  // Pe device foarte slab dezactivam complet glow-urile: sunt cele mai scumpe
  // efecte (cercuri mari semi-transparente suprapuse) pe GPU vechi cu alpha
  // blending lent, si elimina cel mai mult din cauza stutter-ului perceput.
  if (disableGlow) return;

  if (quality >= 2) {
    g.circle(x, y, r * 2.55).fill({ color, alpha: 0.018 * power });
    g.circle(x, y, r * 1.75).fill({ color, alpha: 0.036 * power });
  }

  if (quality >= 1) {
    g.circle(x, y, r * 1.22).fill({ color, alpha: 0.07 * power });
  }
}

function drawOrb(g, orb, cameraX, cameraY, scale, vw, vh, disableGlow = false) {
  const p = screen(orb.x, orb.y, cameraX, cameraY, scale);
  if (p.x < -95 || p.y < -95 || p.x > vw + 95 || p.y > vh + 95) return;

  const color = ORB_COLORS[orb.color] || ORB_COLORS.cyan;
  const light = mixColor(color, 0xffffff, 0.62);
  const r = Math.max(7, 10.5 * scale);

  // Glow exterior mai frumos.
  glow(g, p.x, p.y, r * 1.35, color, 0.82, 1, disableGlow);

  // Aura mica.
  if (!disableGlow) {
    g.circle(p.x, p.y, r * 1.42).fill({
      color,
      alpha: 0.08,
    });
  }

  // Corp lucios.
  g.circle(p.x, p.y, r).fill({
    color,
    alpha: 0.98,
  });

  // Rim.
  g.circle(p.x, p.y, r * 0.96).stroke({
    color: light,
    width: Math.max(1, r * 0.15),
    alpha: 0.36,
  });

  // Highlight principal.
  g.circle(p.x - r * 0.32, p.y - r * 0.36, r * 0.33).fill({
    color: 0xffffff,
    alpha: 0.72,
  });

  // Highlight secundar.
  g.circle(p.x + r * 0.22, p.y + r * 0.24, r * 0.18).fill({
    color: light,
    alpha: 0.22,
  });
}

function drawEnergy(g, cell, cameraX, cameraY, scale, vw, vh, disableGlow = false) {
  const p = screen(cell.x, cell.y, cameraX, cameraY, scale);
  if (p.x < -120 || p.y < -120 || p.x > vw + 120 || p.y > vh + 120) return;

  const color = 0x67ffb1;
  const dark = 0x052818;
  const light = 0xeafff4;
  const rim = 0x9dffd0;

  const r = Math.max(12, 17 * scale);
  const w = r * 1.55;
  const h = r * 2.16;

  glow(g, p.x, p.y, r * 1.2, color, 0.86, 1, disableGlow);

  // Aura verde discreta.
  if (!disableGlow) {
    g.circle(p.x, p.y, r * 1.35).fill({
      color,
      alpha: 0.07,
    });
  }

  // Cap metalic.
  g.roundRect(p.x - w * 0.27, p.y - h * 0.65, w * 0.54, r * 0.28, r * 0.1).fill({
    color: light,
    alpha: 0.82,
  });

  // Carcasa baterie.
  g.roundRect(p.x - w * 0.5, p.y - h * 0.5, w, h, r * 0.34).fill({
    color: dark,
    alpha: 0.96,
  });

  g.roundRect(p.x - w * 0.5, p.y - h * 0.5, w, h, r * 0.34).stroke({
    color: rim,
    width: Math.max(1.4, r * 0.12),
    alpha: 0.78,
  });

  // Interior luminos.
  g.roundRect(p.x - w * 0.33, p.y - h * 0.31, w * 0.66, h * 0.62, r * 0.23).fill({
    color,
    alpha: 0.94,
  });

  // Reflexie verticala.
  g.roundRect(p.x - w * 0.23, p.y - h * 0.23, w * 0.18, h * 0.46, r * 0.12).fill({
    color: light,
    alpha: 0.18,
  });

  // Fulger.
  g.poly([
    p.x + r * 0.10, p.y - r * 0.48,
    p.x - r * 0.22, p.y + r * 0.02,
    p.x + r * 0.02, p.y + r * 0.02,
    p.x - r * 0.11, p.y + r * 0.48,
    p.x + r * 0.34, p.y - r * 0.10,
    p.x + r * 0.10, p.y - r * 0.10,
  ]).fill({
    color: light,
    alpha: 0.96,
  });

  g.circle(p.x - w * 0.18, p.y - h * 0.26, r * 0.19).fill({
    color: 0xffffff,
    alpha: 0.62,
  });
}

function drawCore(g, core, cameraX, cameraY, scale, colorMap, time, vw, vh, disableGlow = false) {
  const p = screen(core.x, core.y, cameraX, cameraY, scale);
  if (p.x < -130 || p.y < -130 || p.x > vw + 130 || p.y > vh + 130) return;

  const color = hex(colorMap[core.type] || "#00eaff");
  const r = Math.max(18, 31 * scale);

  glow(g, p.x, p.y, r, color, 0.95, 1, disableGlow);

  g.circle(p.x, p.y, r).stroke({
    color,
    width: Math.max(1, 2 * scale),
    alpha: 0.74,
  });

  g.circle(p.x, p.y, r * 0.42).fill({
    color,
    alpha: 0.94,
  });

  g.circle(p.x - r * 0.12, p.y - r * 0.14, r * 0.12).fill({
    color: 0xffffff,
    alpha: 0.76,
  });

  g.moveTo(p.x - r * 0.54, p.y - r * 0.54);
  g.lineTo(p.x + r * 0.54, p.y + r * 0.54);
  g.stroke({
    color,
    width: Math.max(2, 4 * scale),
    alpha: 0.62,
  });

  g.moveTo(p.x + r * 0.54, p.y - r * 0.54);
  g.lineTo(p.x - r * 0.54, p.y + r * 0.54);
  g.stroke({
    color,
    width: Math.max(2, 4 * scale),
    alpha: 0.62,
  });
}

function drawArm(g, cx, cy, x, y, primary, light, width, quality = 1) {
  g.moveTo(cx, cy);
  g.lineTo(x, y);
  g.stroke({
    color: primary,
    width,
    alpha: 0.62,
  });

  if (quality >= 2) {
    g.moveTo(cx, cy);
    g.lineTo(x, y);
    g.stroke({
      color: light,
      width: Math.max(1, width * 0.35),
      alpha: 0.2,
    });
  }
}

function drawRotor(g, x, y, r, primary, secondary, light, time, quality = 1, disableGlow = false, spinEnabled = true) {
  const spin = spinEnabled ? time * 0.018 : 0;
  const soft = mixColor(primary, light, 0.45);

  if (quality >= 1) {
    glow(g, x, y, r * 0.9, primary, quality >= 2 ? 0.9 : 0.55, quality, disableGlow);
  }

  g.circle(x, y, r * 1.18).fill({
    color: primary,
    alpha: quality >= 2 ? 0.065 : 0.04,
  });

  g.circle(x, y, r * 1.05).stroke({
    color: light,
    width: Math.max(1.1, r * 0.1),
    alpha: quality >= 2 ? 0.9 : 0.62,
  });

  g.circle(x, y, r * 0.78).stroke({
    color: soft,
    width: Math.max(1, r * 0.075),
    alpha: quality >= 2 ? 0.5 : 0.34,
  });

  g.circle(x, y, r * 0.52).stroke({
    color: secondary,
    width: Math.max(1, r * 0.055),
    alpha: quality >= 2 ? 0.36 : 0.22,
  });

  if (quality >= 1) {
    for (let i = 0; i < 4; i += 1) {
      const a = spin + i * Math.PI * 0.5;
      const bladeLength = r * 0.84;
      const bladeWidth = Math.max(1.2, r * 0.085);

      g.moveTo(
        x + Math.cos(a + Math.PI / 2) * bladeWidth,
        y + Math.sin(a + Math.PI / 2) * bladeWidth
      );
      g.lineTo(
        x + Math.cos(a) * bladeLength,
        y + Math.sin(a) * bladeLength
      );
      g.lineTo(
        x + Math.cos(a - Math.PI / 2) * bladeWidth,
        y + Math.sin(a - Math.PI / 2) * bladeWidth
      );
      g.fill({
        color: i % 2 ? secondary : light,
        alpha: quality >= 2 ? 0.32 : 0.22,
      });
    }
  }

  g.circle(x, y, r * 0.31).fill({
    color: secondary,
    alpha: 0.98,
  });

  g.circle(x, y, r * 0.18).fill({
    color: light,
    alpha: 0.96,
  });

  if (quality >= 2) {
    g.circle(x - r * 0.08, y - r * 0.09, r * 0.075).fill({
      color: 0xffffff,
      alpha: 0.56,
    });
  }
}

function drawBody(g, x, y, size, colors, leanX = 0, leanY = 0, quality = 1) {
  const primary = hex(colors[0]);
  const secondary = hex(colors[1]);
  const dark = hex(colors[2]);
  const light = hex(colors[3]);

  const ox = leanX * size * 0.035;
  const oy = leanY * size * 0.035;

  const w = size * 0.43;
  const h = size * 0.68;
  const cx = x + ox;
  const cy = y + oy;

  const bright = mixColor(primary, light, 0.6);
  const deep = mixColor(dark, primary, 0.18);
  const glass = mixColor(light, primary, 0.22);

  // Smaller glow only around the body, no large blue radiation rings.
  if (quality >= 1) {
    g.ellipse(cx, cy + h * 0.03, w * 0.58, h * 0.64).fill({
      color: primary,
      alpha: 0.055,
    });
  }

  // Outer glossy shell.
  g.ellipse(cx, cy + h * 0.04, w * 0.52, h * 0.6).fill({
    color: deep,
    alpha: 1,
  });

  g.ellipse(cx, cy, w * 0.48, h * 0.56).fill({
    color: primary,
    alpha: 1,
  });

  // Main bright glass panel.
  g.ellipse(cx - w * 0.1, cy - h * 0.11, w * 0.33, h * 0.42).fill({
    color: secondary,
    alpha: quality >= 2 ? 0.52 : 0.42,
  });

  // Soft highlight.
  g.ellipse(cx - w * 0.22, cy - h * 0.28, w * 0.2, h * 0.19).fill({
    color: light,
    alpha: 0.72,
  });

  // Vertical glossy streak.
  if (quality >= 1) {
    g.ellipse(cx - w * 0.02, cy - h * 0.02, w * 0.13, h * 0.42).fill({
      color: glass,
      alpha: 0.18,
    });
  }

  // Lower inner lens.
  g.ellipse(cx + w * 0.02, cy + h * 0.23, w * 0.21, h * 0.22).fill({
    color: light,
    alpha: 0.88,
  });

  g.ellipse(cx + w * 0.04, cy + h * 0.2, w * 0.11, h * 0.14).fill({
    color: primary,
    alpha: 0.25,
  });

  // Dark side visor.
  g.ellipse(cx + w * 0.31, cy - h * 0.19, w * 0.22, h * 0.27).fill({
    color: 0x020815,
    alpha: 0.96,
  });

  g.circle(cx + w * 0.23, cy - h * 0.28, Math.max(2.5, size * 0.025)).fill({
    color: light,
    alpha: 0.55,
  });

  // Crisp rim, no wide aura.
  if (quality >= 1) {
    g.ellipse(cx, cy, w * 0.49, h * 0.57).stroke({
      color: mixColor(light, primary, 0.42),
      width: Math.max(1, size * 0.012),
      alpha: 0.28,
    });
  }
}

function drawMiniDrone(g, x, y, scale, colors, time, quality = 1, orbitAngle = 0, disableGlow = false, spinEnabled = true) {
  const primary = hex(colors[0]);
  const secondary = hex(colors[1]);
  const dark = hex(colors[2]);
  const light = hex(colors[3]);
  const bright = mixColor(primary, light, 0.45);

  const size = Math.max(24, 46 * scale);
  const body = size * 0.58;
  const rotorR = size * 0.17;

  if (quality >= 1) {
    // Smaller glow for sharper mini attack drones.
    glow(g, x, y, size * 0.38, primary, 0.32, 1, disableGlow);
  }

  const rotors = [
    { x: -body * 0.65, y: -body * 0.5 },
    { x: body * 0.65, y: -body * 0.5 },
    { x: -body * 0.65, y: body * 0.5 },
    { x: body * 0.65, y: body * 0.5 },
  ];

  rotors.forEach((rp) =>
    drawArm(g, x, y, x + rp.x, y + rp.y, primary, light, Math.max(1, size * 0.04), quality)
  );

  rotors.forEach((rp) =>
    drawRotor(g, x + rp.x, y + rp.y, rotorR, primary, secondary, light, time, quality, disableGlow, spinEnabled)
  );

  g.ellipse(x, y, body * 0.34, body * 0.44).fill({
    color: primary,
    alpha: 1,
  });

  g.ellipse(x - body * 0.08, y - body * 0.07, body * 0.21, body * 0.29).fill({
    color: bright,
    alpha: 0.26,
  });

  g.ellipse(x + body * 0.12, y + body * 0.16, body * 0.22, body * 0.18).fill({
    color: dark,
    alpha: 0.22,
  });

  g.circle(x - body * 0.13, y - body * 0.26, size * 0.044).fill({
    color: 0xffffff,
    alpha: 0.88,
  });

  g.circle(x + body * 0.23, y - body * 0.18, size * 0.041).fill({
    color: 0x020815,
    alpha: 0.96,
  });

  g.circle(x, y + body * 0.16, size * 0.032).fill({
    color: light,
    alpha: 0.94,
  });
}

function drawShield(g, x, y, radius, primary, time, quality = 1) {
  const pulse = 1 + Math.sin(time * 0.006) * 0.035;

  g.circle(x, y, radius * 1.14 * pulse).fill({
    color: primary,
    alpha: quality >= 2 ? 0.055 : 0.035,
  });

  g.circle(x, y, radius * 1.02).stroke({
    color: primary,
    width: Math.max(2, radius * 0.018),
    alpha: quality >= 2 ? 0.88 : 0.65,
  });

  if (quality >= 2) {
    g.circle(x, y, radius * 0.82).fill({
      color: primary,
      alpha: 0.018,
    });

    for (let i = 0; i < 6; i += 1) {
      const a = time * 0.0014 + i * ((Math.PI * 2) / 6);
      const a2 = a + 0.22;

      g.moveTo(x + Math.cos(a) * radius * 1.02, y + Math.sin(a) * radius * 1.02);
      g.lineTo(x + Math.cos(a2) * radius * 1.02, y + Math.sin(a2) * radius * 1.02);
      g.stroke({
        color: 0xffffff,
        width: Math.max(1, radius * 0.012),
        alpha: 0.32,
      });
    }
  }
}

function drawDrone(g, unit, cameraX, cameraY, scale, time, options = {}, vw = 0, vh = 0) {
  if (!unit || unit.alive === false) return;

  const p = screen(unit.x, unit.y, cameraX, cameraY, scale);
  if (p.x < -320 || p.y < -320 || p.x > vw + 320 || p.y > vh + 320) return;

  const skin = normalizeSkin(unit.skin);
  const colors = SKIN_THEMES[skin] || SKIN_THEMES.cyan;

  const primary = hex(colors[0]);
  const secondary = hex(colors[1]);
  const light = hex(colors[3]);

  const isPlayer = options.isPlayer === true;
  const isNear = options.isNear !== false;
  const disableGlow = options.disableGlow === true;
  // IMPORTANT: pe device foarte slab (disableAnimations), rotoarele nu se mai
  // invart (spinEnabled=false trimis catre drawRotor) si mini-dronele NU mai
  // orbiteaza in jurul dronei mari - apar fixe pe ultima pozitie calculata.
  // Eliminam astfel costul de Math.cos/Math.sin recalculat la fiecare frame
  // pentru fiecare rotor (4 per drona) si pentru fiecare mini-drona orbitala
  // (pana la 4 per drona), multiplicat cu pana la 69 de boti simultan.
  const disableAnimations = options.disableAnimations === true;
  const quality = Number.isFinite(options.quality) ? options.quality : isPlayer ? 2 : isNear ? 1 : 0;

  const visualSize = Math.max(STANDARD_DRONE_MIN_SIZE, (STANDARD_DRONE_SIZE) * scale);
  const rotorBase = visualSize * 0.92;
  const rotorR = visualSize * 0.15;

  const leanX = unit.moveX || 0;
  const leanY = unit.moveY || 0;

  if (quality >= 1) {
    // Clean glossy glow only, no large radiation rings around the drone.
    glow(g, p.x, p.y, visualSize * 0.42, primary, isPlayer ? 0.45 : 0.28, Math.min(quality, 1), disableGlow);
  }

  const rotors = [
    { x: -rotorBase * 0.52, y: -rotorBase * 0.46 },
    { x: rotorBase * 0.52, y: -rotorBase * 0.46 },
    { x: -rotorBase * 0.52, y: rotorBase * 0.46 },
    { x: rotorBase * 0.52, y: rotorBase * 0.46 },
  ];

  rotors.forEach((rp) =>
    drawArm(
      g,
      p.x,
      p.y,
      p.x + rp.x,
      p.y + rp.y,
      primary,
      light,
      Math.max(1, visualSize * 0.032),
      quality
    )
  );

  rotors.forEach((rp) =>
    drawRotor(
      g,
      p.x + rp.x,
      p.y + rp.y,
      rotorR,
      primary,
      secondary,
      light,
      time,
      quality,
      disableGlow,
      !disableAnimations
    )
  );

  drawBody(g, p.x, p.y, visualSize, colors, leanX, leanY, quality);

  if (hasActiveShield(unit)) {
    drawShield(g, p.x, p.y, visualSize * 0.95, primary, time, quality);
  }

  const droneCount = Math.min(unit.drones || 0, 8);
  if (droneCount <= 0) return;

  const orbitBase = unit.attacking && !unit.isBot ? 175 : 145;
  const orbitRadius = orbitBase * scale;

  const mouseAngle = Math.atan2((unit.mouseY || unit.y) - unit.y, (unit.mouseX || unit.x) - unit.x);
  const attackOffset =
    unit.attacking && !unit.isBot
      ? { x: Math.cos(mouseAngle) * 75, y: Math.sin(mouseAngle) * 75 }
      : { x: 0, y: 0 };

  // IMPORTANT: pe device foarte slab, orbitRotation e fortat la 0 - mini-
  // dronele raman pe pozitia lor unghiulara initiala (distribuite uniform in
  // jurul dronei mari), fara sa se mai roteasca in jurul axei. Vizual: orbii
  // colectati apar in continuare ca mini-drone in jurul dronei, dar stau pe
  // loc, fara animatie de rotatie continua.
  const orbitRotation = disableAnimations ? 0 : time * (unit.attacking ? 0.0032 : 0.00125);

  if (quality >= 1 && droneCount > 0) {
    // Visible but clean orbit line for the small drones.
    g.circle(p.x, p.y, orbitRadius).stroke({
      color: mixColor(primary, light, 0.48),
      width: Math.max(1.4, visualSize * 0.015),
      alpha: isPlayer ? 0.58 : 0.34,
    });
  }

  for (let i = 0; i < droneCount; i += 1) {
    const angle = (i / droneCount) * Math.PI * 2 + orbitRotation;
    const miniWorldX = unit.x + Math.cos(angle) * orbitBase + attackOffset.x;
    const miniWorldY = unit.y + Math.sin(angle) * orbitBase + attackOffset.y;
    const mini = screen(miniWorldX, miniWorldY, cameraX, cameraY, scale);

    drawMiniDrone(
      g,
      mini.x,
      mini.y,
      scale,
      colors,
      time,
      quality >= 1 ? 1 : 0,
      angle,
      disableGlow,
      !disableAnimations
    );
  }
}

function drawAttackDrone(g, projectile, cameraX, cameraY, scale, time, vw, vh, full = true, disableGlow = false) {
  const p = screen(projectile.x, projectile.y, cameraX, cameraY, scale);
  if (p.x < -110 || p.y < -110 || p.x > vw + 110 || p.y > vh + 110) return;

  const skin = normalizeSkin(projectile.skin);
  const colors = SKIN_THEMES[skin] || SKIN_THEMES.cyan;
  const primary = hex(colors[0]);
  const angle = projectile.angle || 0;

  if (full) {
    const tail = Math.max(18, 34 * scale);

    g.moveTo(p.x - Math.cos(angle) * tail, p.y - Math.sin(angle) * tail);
    g.lineTo(p.x, p.y);
    g.stroke({
      color: primary,
      width: Math.max(2, 4 * scale),
      alpha: 0.18,
    });
  }

  drawMiniDrone(g, p.x, p.y, Math.max(scale * 1.18, scale), colors, time, full ? 1 : 0, angle, disableGlow);

  if (projectile.pierceLeft > 1) {
    g.circle(p.x, p.y, Math.max(14, 22 * scale)).stroke({
      color: primary,
      width: 2,
      alpha: 0.52,
    });
  }
}

function PixiArenaRenderer({
  player,
  players = [],
  bots = [],
  simpleBots = [],
  orbs = [],
  energyCells = [],
  cores = [],
  projectiles = [],
  simpleProjectiles = [],
  cameraX = 0,
  cameraY = 0,
  scale = 1,
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720,
  coreTypes = [],
  otherPlayerSize = STANDARD_DRONE_SIZE,
  otherPlayerQuality = 1,
  liveDataRef = null,
  // Switch global de calitate grafica (Normal/Low), setat din Dashboard si
  // pasat catre toate modurile de joc. Citit O SINGURA DATA la montarea
  // componentei (in setup() de mai jos), NU dintr-un ref citit in ticker -
  // schimbarea switch-ului in timpul unui meci nu se aplica live, ci la
  // urmatoarea intrare in arena (remount). Simplu si predictibil, fara
  // bucle de redetectie sau resize-uri repetate la runtime.
  forceLowQuality = false,
}) {
  const hostRef = useRef(null);
  const appRef = useRef(null);
  const graphicsRef = useRef(null);
  const latestRef = useRef(null);
  const performanceRef = useRef({
    lowQualityUntil: 0,
    lastSlowFrameAt: 0,
    frames: 0,
    fpsStartedAt: typeof performance !== "undefined" ? performance.now() : 0,
    fps: 60,
    dynamicQuality: 2,
    lastQualityChangeAt: 0,
    device: getDeviceProfile(),
  });

  const coreColorMap = useMemo(() => {
    return coreTypes.reduce((acc, core) => {
      acc[core.type] = core.color;
      return acc;
    }, {});
  }, [coreTypes]);

  latestRef.current = {
    player,
    players,
    bots,
    simpleBots,
    orbs,
    energyCells,
    cores,
    projectiles,
    simpleProjectiles,
    cameraX,
    cameraY,
    scale,
    viewportWidth,
    viewportHeight,
    coreColorMap,
    otherPlayerSize,
    otherPlayerQuality,
  };

  useEffect(() => {
    let destroyed = false;
    let app;

    async function setup() {
      if (!hostRef.current) return;

      app = new PIXI.Application();

      const device = getDeviceProfile();
      performanceRef.current.device = device;
      performanceRef.current.forceLowQuality = forceLowQuality;

      // Switch manual de calitate (Low): fortam exact comportamentul deja
      // existent pentru device foarte slab (isVeryLowEndMobile), indiferent
      // de ce a detectat profilul automat al device-ului. Rezolutie minima
      // (1, fara supersampling), fara antialias, calitate dinamica 0 de la
      // pornire.
      const effectiveResolution = forceLowQuality ? 1 : device.resolution;
      const effectiveAntialias = forceLowQuality ? false : !device.isVeryLowEndMobile;

      // Pe device foarte slab SAU cu Low Quality activat manual, incepem direct
      // cu calitate dinamica redusa, in loc sa asteptam ca FPS-ul sa scada o
      // data (reactiv) inainte sa reducem - asta elimina exact primele secunde
      // de "sacaiala" pana se auto-ajusteaza.
      if (device.isVeryLowEndMobile || forceLowQuality) {
        performanceRef.current.dynamicQuality = 0;
      }

      const config = {
        width: hostRef.current.clientWidth || window.innerWidth,
        height: hostRef.current.clientHeight || window.innerHeight,
        backgroundAlpha: 0,
        // Antialias (MSAA) e relativ scump pe GPU-uri vechi cu multe draw call-uri
        // suprapuse (fiecare drona = ~15-20 forme). Pe device foarte slab SAU cu
        // Low Quality activat manual il dezactivam complet; marginile sunt usor
        // mai aspre, dar framerate-ul devine mult mai stabil.
        antialias: effectiveAntialias,
        resolution: Math.max(1, effectiveResolution),
        autoDensity: true,
        powerPreference: "high-performance",
        preference: "webgl",
      };

      if (typeof app.init === "function") {
        await app.init(config);
      } else {
        app = new PIXI.Application(config);
      }

      if (destroyed) {
        app.destroy(true);
        return;
      }

      appRef.current = app;
      hostRef.current.appendChild(app.canvas || app.view);

      const graphics = new PIXI.Graphics();
      graphicsRef.current = graphics;
      app.stage.addChild(graphics);

      const resize = () => {
        const width = hostRef.current?.clientWidth || window.innerWidth;
        const height = hostRef.current?.clientHeight || window.innerHeight;
        const nextDevice = getDeviceProfile();
        performanceRef.current.device = nextDevice;

        const targetResolution = forceLowQuality ? 1 : nextDevice.resolution;

        if (app.renderer?.resolution !== targetResolution) {
          app.renderer.resolution = Math.max(1, targetResolution);
        }

        app.renderer.resize(width, height);
      };

      window.addEventListener("resize", resize);
      resize();

      // NU mai plafonam app.ticker.maxFPS. Randarea ruleaza la rata pe care
      // device-ul o poate sustine natural, in sincron cu bucla de joc (rAF,
      // 60Hz). Un plafon artificial (ex 30fps) facea ca randarea sa citeasca
      // pozitii din pixiLiveRef mai rar decat sunt actualizate, producand
      // exact senzatia de miscare "in trepte"/sacadata pe device-uri slabe.

      app.ticker.add(() => {
        const g = graphicsRef.current;
        const data = liveDataRef?.current || latestRef.current;

        if (!g || !data) return;

        const {
          player: currentPlayer,
          players: currentPlayers = [],
          bots: currentBots = [],
          simpleBots: currentSimpleBots = [],
          orbs: currentOrbs = [],
          energyCells: currentEnergyCells = [],
          cores: currentCores = [],
          projectiles: currentProjectiles = [],
          simpleProjectiles: currentSimpleProjectiles = [],
          cameraX: cx,
          cameraY: cy,
          scale: worldScale,
          viewportWidth: rawViewportWidth,
          viewportHeight: rawViewportHeight,
          coreColorMap: map,
          otherPlayerSize: pvpOtherPlayerSize = STANDARD_DRONE_SIZE,
          otherPlayerQuality: pvpOtherPlayerQuality = 1,
        } = data;

        const vw = rawViewportWidth || app.renderer.width || window.innerWidth;
        const vh = rawViewportHeight || app.renderer.height || window.innerHeight;

        const time = performance.now();
        const perf = performanceRef.current;
        const device = perf.device || getDeviceProfile();

        perf.frames += 1;
        if (time - perf.fpsStartedAt >= 1000) {
          perf.fps = Math.round((perf.frames * 1000) / Math.max(1, time - perf.fpsStartedAt));
          perf.frames = 0;
          perf.fpsStartedAt = time;

          // Pragurile sunt raportate la 60fps real (randarea nu mai e plafonata).
          // Pe device foarte slab folosim praguri puțin mai relaxate ca sa nu
          // oscileze constant intre calitati cand framerate-ul natural al
          // device-ului e deja sub 60fps stabil.
          const lowThreshold = device.isVeryLowEndMobile ? 22 : 47;
          const highThreshold = device.isVeryLowEndMobile ? 27 : 57;

          if (time - perf.lastQualityChangeAt > 1400) {
            if (perf.fps < lowThreshold && perf.dynamicQuality > 0) {
              perf.dynamicQuality -= 1;
              perf.lowQualityUntil = time + 1800;
              perf.lastQualityChangeAt = time;
            } else if (perf.fps > highThreshold && perf.dynamicQuality < 3 && !device.isLowEndMobile) {
              perf.dynamicQuality += 1;
              perf.lastQualityChangeAt = time;
            }
          }
        }

        const slowFrameThresholdMs = device.isVeryLowEndMobile ? 46 : 24;
        if (app.ticker.deltaMS > slowFrameThresholdMs && time - perf.lastSlowFrameAt > 220) {
          perf.lowQualityUntil = time + 1200;
          perf.lastSlowFrameAt = time;

          if (perf.dynamicQuality > 0 && time - perf.lastQualityChangeAt > 900) {
            perf.dynamicQuality -= 1;
            perf.lastQualityChangeAt = time;
          }
        }

        const isForcedLow = Boolean(perf.forceLowQuality);

        const budget = isForcedLow
          ? getQualityBudget(
              { ...device, isVeryLowEndMobile: true, isLowEndMobile: true, isWeakDesktop: false, tier: MOBILE_PERF_PROFILES.LOW },
              0
            )
          : getQualityBudget(device, time < perf.lowQualityUntil ? Math.min(perf.dynamicQuality, 1) : perf.dynamicQuality);
        const lowQuality = budget.quality <= 0;
        const disableGlow = Boolean(budget.disableGlow) || isForcedLow;
        // IMPORTANT: pe device foarte slab (isVeryLowEndMobile), pe mobil
        // slab generic (isLowEndMobile), pe laptop/PC slab (isWeakDesktop,
        // RAM <= 8GB SAU <= 4 nuclee), SAU cu switch-ul manual de Low Quality
        // activat din Dashboard, dezactivam complet animatia de rotire a
        // celor 4 rotoare ale fiecarei drone SI orbita mini-dronelor in jurul
        // dronei mari. Cand un bot/jucator stranga orbi, mini-drona aferenta
        // apare direct pe pozitia ei (fixa), fara sa se mai roteasca. Asta
        // elimina calculul de Math.cos/Math.sin per rotor/mini-drona la
        // fiecare frame, cel mai vizibil cu pana la 69 de boti simultan pe
        // ecran.
        const disableAnimations = Boolean(
          device.isVeryLowEndMobile || device.isLowEndMobile || device.isWeakDesktop || isForcedLow
        );
        const viewBounds = getWorldViewBounds(cx, cy, worldScale, vw, vh, budget.margin);

        g.clear();

        const visibleOrbs = filterVisibleItems(currentOrbs, viewBounds, 24, budget.orbs);
        const visibleEnergyCells = filterVisibleItems(currentEnergyCells, viewBounds, 45, budget.energy);
        const visibleCores = filterVisibleItems(currentCores, viewBounds, 85, budget.cores);

        const visiblePlayers = (currentPlayers || [])
          .filter((unit) => unit?.alive !== false && unit.id !== currentPlayer?.id && isWorldVisible(unit, viewBounds, 330))
          .slice(0, budget.players);

        const visibleBots = (currentBots || [])
          .filter((unit) => unit?.alive !== false && isWorldVisible(unit, viewBounds, 320))
          .slice(0, budget.bots);

        const visibleSimpleBots = budget.simpleBots > 0
          ? (currentSimpleBots || [])
              .filter((unit) => unit?.alive !== false && isWorldVisible(unit, viewBounds, 80))
              .slice(0, budget.simpleBots)
          : [];

        const visibleProjectiles = filterVisibleItems(currentProjectiles, viewBounds, 120, budget.projectiles);
        const visibleSimpleProjectiles = filterVisibleItems(currentSimpleProjectiles, viewBounds, 80, budget.simpleProjectiles);

        if (budget.drawLiteItems) {
          visibleOrbs.forEach((orb) => drawOrbLite(g, orb, cx, cy, worldScale, vw, vh));
          visibleEnergyCells.forEach((cell) => drawEnergyLite(g, cell, cx, cy, worldScale, vw, vh));
        } else {
          visibleOrbs.forEach((orb) => drawOrb(g, orb, cx, cy, worldScale, vw, vh, disableGlow));
          visibleEnergyCells.forEach((cell) => drawEnergy(g, cell, cx, cy, worldScale, vw, vh, disableGlow));
        }

        visibleCores.forEach((core) => drawCore(g, core, cx, cy, worldScale, map, time, vw, vh, disableGlow));

        visibleSimpleBots.forEach((bot) => {
          const p = screen(bot.x, bot.y, cx, cy, worldScale);
          const skin = normalizeSkin(bot.skin);
          const color = hex((SKIN_THEMES[skin] || SKIN_THEMES.cyan)[0]);

          g.circle(p.x, p.y, Math.max(8, 13 * worldScale)).fill({
            color,
            alpha: 0.84,
          });

          g.circle(p.x - 2 * worldScale, p.y - 2 * worldScale, Math.max(2, 4 * worldScale)).fill({
            color: 0xffffff,
            alpha: 0.5,
          });
        });

        if (currentPlayer && currentPlayer.alive !== false) {
          drawDrone(g, currentPlayer, cx, cy, worldScale, time, {
            size: STANDARD_DRONE_SIZE,
            isPlayer: true,
            isNear: true,
            quality: budget.playerQuality,
            disableGlow,
            disableAnimations,
          }, vw, vh);
        }

        visiblePlayers.forEach((unit) => {
          drawDrone(g, unit, cx, cy, worldScale, time, {
            size: STANDARD_DRONE_SIZE,
            isPlayer: false,
            isNear: true,
            quality: Math.min(pvpOtherPlayerQuality, budget.botQuality),
            disableGlow,
            disableAnimations,
          }, vw, vh);
        });

        visibleBots.forEach((unit) => {
          const dx = (unit.x || 0) - (currentPlayer?.x || 0);
          const dy = (unit.y || 0) - (currentPlayer?.y || 0);
          const isNear = dx * dx + dy * dy < 900 * 900;

          drawDrone(g, unit, cx, cy, worldScale, time, {
            size: STANDARD_DRONE_SIZE,
            isPlayer: false,
            isNear,
            quality: isNear ? budget.botQuality : 0,
            disableGlow,
            disableAnimations,
          }, vw, vh);
        });

        visibleProjectiles.forEach((projectile) => {
          drawAttackDrone(g, projectile, cx, cy, worldScale, time, vw, vh, true, disableGlow);
        });

        visibleSimpleProjectiles.forEach((projectile) => {
          drawAttackDrone(g, projectile, cx, cy, worldScale, time, vw, vh, false, disableGlow);
        });
      });

      app.__resizeHandler = resize;
    }

    setup();

    return () => {
      destroyed = true;

      if (appRef.current) {
        if (appRef.current.__resizeHandler) {
          window.removeEventListener("resize", appRef.current.__resizeHandler);
        }

        appRef.current.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true,
        });
      }

      appRef.current = null;
      graphicsRef.current = null;

      if (hostRef.current) {
        hostRef.current.innerHTML = "";
      }
    };
  }, []);

  return <div ref={hostRef} className="pixi-arena-layer" />;
}

export default PixiArenaRenderer;
