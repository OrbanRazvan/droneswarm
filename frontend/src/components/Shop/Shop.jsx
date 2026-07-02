import "./Shop.css";

const FALLBACK_PALETTE = {
  primary: "#00eaff",
  secondary: "#78f7ff",
  dark: "#003140",
  highlight: "#ffffff",
};

function getPalette(skin = {}) {
  const value = skin?.colors;

  if (Array.isArray(value) && value.length >= 4) {
    return {
      primary: value[0] || FALLBACK_PALETTE.primary,
      secondary: value[1] || FALLBACK_PALETTE.secondary,
      dark: value[2] || FALLBACK_PALETTE.dark,
      highlight: value[3] || FALLBACK_PALETTE.highlight,
    };
  }

  if (value && typeof value === "object") {
    return {
      primary: value.primary || FALLBACK_PALETTE.primary,
      secondary: value.secondary || FALLBACK_PALETTE.secondary,
      dark: value.dark || FALLBACK_PALETTE.dark,
      highlight: value.highlight || FALLBACK_PALETTE.highlight,
    };
  }

  return FALLBACK_PALETTE;
}

function getDroneRole(skin, index = 0, fallback = "ARENA DRONE") {
  return String(skin?.role || fallback || `DRONE ${index + 1}`).toUpperCase();
}

function getRoleClass(role = "") {
  const normalized = String(role).toLowerCase();
  if (normalized.includes("tank")) return "tank";
  if (normalized.includes("defender") || normalized.includes("defense")) return "defender";
  if (normalized.includes("attack")) return "attack";
  return "arena";
}

/*
  Static SVG only. The chassis, arms and rotor coordinates mirror the real
  arena illustration: [-59,-45], [59,-45], [-59,45], [59,45].
  No Pixi canvas, ticker, WebGL context or animation is created in the store.
*/
function StoreDroneArtwork({ skin, role = "ARENA DRONE", compact = false }) {
  const { primary, secondary, dark, highlight } = getPalette(skin);
  const roleClass = getRoleClass(role);
  const skinId = String(skin?.id || "").toLowerCase();
  const isStarterCommand = String(skin?.family || "").toLowerCase() === "starter" || skinId.includes("basic-");
  const compactSize = compact ? 15 : 21;
  const blade = compact ? 8 : 13;

  const rotor = (x, y, key) => (
    <g key={key}>
      <circle cx={x} cy={y} r={compactSize} fill={dark} stroke={secondary} strokeWidth={compact ? 2 : 2.7} />
      <circle cx={x} cy={y} r={compactSize - (compact ? 3 : 5)} fill="#020713" stroke={primary} strokeWidth={compact ? 1 : 1.4} />
      <path d={`M ${x - blade} ${y - blade * 0.34} L ${x + blade} ${y + blade * 0.34}`} stroke={secondary} strokeWidth={compact ? 2.5 : 4} strokeLinecap="round" opacity="0.62" />
      <path d={`M ${x - blade * 0.34} ${y + blade} L ${x + blade * 0.34} ${y - blade}`} stroke={primary} strokeWidth={compact ? 2.5 : 4} strokeLinecap="round" opacity="0.52" />
      <circle cx={x} cy={y} r={compact ? 4.3 : 6.1} fill={dark} />
      <circle cx={x} cy={y} r={compact ? 2.8 : 4.3} fill={primary} />
      <circle cx={x - (compact ? 0.9 : 1.35)} cy={y - (compact ? 1.1 : 1.55)} r={compact ? 1.05 : 1.55} fill={highlight} />
    </g>
  );

  return (
    <div className={`store-drone-art store-drone-art-${roleClass}`} title={skin?.name || role}>
      <svg viewBox="-130 -130 260 260" role="img" aria-label={`${skin?.name || role} static drone preview`}>
        <defs>
          <radialGradient id={`store-glow-${skin?.id || role}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={primary} stopOpacity="0.23" />
            <stop offset="68%" stopColor={primary} stopOpacity="0.04" />
            <stop offset="100%" stopColor={primary} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="0" cy="0" r="112" fill={`url(#store-glow-${skin?.id || role})`} />
        <circle cx="0" cy="0" r="103" fill="none" stroke={primary} strokeOpacity="0.25" strokeWidth="2" />
        <circle cx="0" cy="0" r="84" fill={dark} fillOpacity="0.17" stroke={secondary} strokeOpacity="0.26" strokeWidth="1.2" />

        {isStarterCommand && roleClass === "attack" && (
          <g>
            <path d="M 0 -70 L 14 -39 L 38 -16 L 27 5 L 17 42 L 0 59 L -17 42 L -27 5 L -38 -16 L -14 -39 Z" fill={dark} stroke={secondary} strokeWidth="2.35" />
            <path d="M 0 -61 L 9 -34 L 29 -14 L 18 5 L 9 33 L 0 47 L -9 33 L -18 5 L -29 -14 L -9 -34 Z" fill={primary} />
            <path d="M -57 -9 L -25 -9 L -17 8 L -54 29 Z" fill={dark} stroke={secondary} strokeWidth="1.8" />
            <path d="M 57 -9 L 25 -9 L 17 8 L 54 29 Z" fill={dark} stroke={secondary} strokeWidth="1.8" />
            <path d="M -44 -4 L -27 -4 L -22 6 L -45 19 Z" fill={highlight} opacity="0.95" />
            <path d="M 44 -4 L 27 -4 L 22 6 L 45 19 Z" fill={highlight} opacity="0.95" />
          </g>
        )}

        {isStarterCommand && roleClass === "tank" && (
          <g>
            <rect x="-54" y="-45" width="108" height="90" rx="22" fill={dark} stroke={secondary} strokeWidth="2.8" />
            <path d="M -43 -37 L 43 -37 L 49 -14 L 38 35 L 19 55 L -19 55 L -38 35 L -49 -14 Z" fill={primary} />
            <rect x="-31" y="-29" width="62" height="20" rx="7" fill={dark} stroke={highlight} strokeWidth="1.8" />
            {[-26, -8, 8, 26].map((x) => <rect key={`command-${x}`} x={x - 5} y="-23" width="10" height="7" rx="2" fill={highlight} />)}
            <rect x="-59" y="-11" width="13" height="44" rx="5" fill={dark} stroke={highlight} strokeWidth="1.6" />
            <rect x="46" y="-11" width="13" height="44" rx="5" fill={dark} stroke={highlight} strokeWidth="1.6" />
          </g>
        )}

        {isStarterCommand && roleClass === "defender" && (
          <g>
            <path d="M 0 -68 L 38 -45 L 59 -7 L 49 35 L 20 64 L -20 64 L -49 35 L -59 -7 L -38 -45 Z" fill={dark} stroke={secondary} strokeWidth="2.7" />
            <path d="M 0 -57 L 30 -38 L 46 -5 L 37 26 L 15 52 L -15 52 L -37 26 L -46 -5 L -30 -38 Z" fill={primary} />
            <path d="M 0 -42 L 17 -21 L 25 0 L 15 24 L 0 40 L -15 24 L -25 0 L -17 -21 Z" fill={dark} stroke={highlight} strokeWidth="2.1" />
            <rect x="-64" y="-22" width="14" height="52" rx="5" fill={dark} stroke={highlight} strokeWidth="1.8" />
            <rect x="50" y="-22" width="14" height="52" rx="5" fill={dark} stroke={highlight} strokeWidth="1.8" />
          </g>
        )}

        {!isStarterCommand && roleClass === "attack" && (
          <g>
            <path d="M -72 -13 L -29 -24 L -16 -3 L -58 29 Z" fill={dark} stroke={secondary} strokeWidth="2" />
            <path d="M 72 -13 L 29 -24 L 16 -3 L 58 29 Z" fill={dark} stroke={secondary} strokeWidth="2" />
            <path d="M -61 -8 L -30 -14 L -22 0 L -53 22 Z" fill={primary} opacity="0.74" />
            <path d="M 61 -8 L 30 -14 L 22 0 L 53 22 Z" fill={primary} opacity="0.74" />
          </g>
        )}

        {!isStarterCommand && roleClass === "tank" && (
          <g>
            <rect x="-55" y="-8" width="16" height="48" rx="7" fill={dark} stroke={secondary} strokeWidth="2.2" />
            <rect x="39" y="-8" width="16" height="48" rx="7" fill={dark} stroke={secondary} strokeWidth="2.2" />
            <path d="M -45 -28 L 45 -28 L 53 14 L 30 53 L -30 53 L -53 14 Z" fill={dark} fillOpacity="0.88" stroke={highlight} strokeOpacity="0.72" strokeWidth="2.3" />
            <path d="M -28 -34 L 28 -34 L 34 -18 L -34 -18 Z" fill={primary} opacity="0.88" />
          </g>
        )}

        {!isStarterCommand && roleClass === "defender" && (
          <g>
            <circle cx="0" cy="0" r="56" fill="none" stroke={secondary} strokeWidth="4" strokeOpacity="0.82" />
            <circle cx="0" cy="0" r="45" fill="none" stroke={primary} strokeWidth="1.5" strokeOpacity="0.44" />
            <path d="M -47 -18 L -63 6 L -43 31" fill="none" stroke={highlight} strokeWidth="4" strokeLinecap="round" opacity="0.82" />
            <path d="M 47 -18 L 63 6 L 43 31" fill="none" stroke={highlight} strokeWidth="4" strokeLinecap="round" opacity="0.82" />
          </g>
        )}

        {[
          [-59, -45],
          [59, -45],
          [-59, 45],
          [59, 45],
        ].map(([x, y]) => {
          const fromX = x < 0 ? -21 : 21;
          const fromY = y < 0 ? -17 : 17;
          return (
            <g key={`arm-${x}-${y}`}>
              <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={dark} strokeWidth="12" strokeLinecap="round" />
              <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={primary} strokeWidth="6.3" strokeLinecap="round" opacity="0.86" />
              <line x1={fromX} y1={fromY} x2={x} y2={y} stroke={secondary} strokeWidth="1.35" strokeLinecap="round" opacity="0.9" />
            </g>
          );
        })}

        {rotor(-59, -45, "tl")}
        {rotor(59, -45, "tr")}
        {rotor(-59, 45, "bl")}
        {rotor(59, 45, "br")}

        <path d="M 0 -52 L 23 -39 L 34 -8 L 30 24 L 17 47 L 0 56 L -17 47 L -30 24 L -34 -8 L -23 -39 Z" fill={dark} />
        <path d="M 0 -47 L 17 -34 L 25 -7 L 22 21 L 12 40 L 0 47 L -12 40 L -22 21 L -25 -7 L -17 -34 Z" fill={primary} />
        <path d="M 0 -41 L 7 -26 L 9 12 L 4 34 L 0 39 L -4 34 L -9 12 L -7 -26 Z" fill={dark} fillOpacity="0.58" />
        <path d="M 0 -42 L 12 -29 L 11 -10 L 0 -2 L -11 -10 L -12 -29 Z" fill={secondary} fillOpacity="0.70" />
        <path d="M 0 -38 L 6 -29 L 5 -17 L 0 -13 L -5 -17 L -6 -29 Z" fill={highlight} fillOpacity="0.84" />
        <rect x="-24" y="8" width="8" height="18" rx="3" fill={dark} />
        <rect x="16" y="8" width="8" height="18" rx="3" fill={dark} />
        <rect x="-22" y="10" width="4" height="12" rx="2" fill={secondary} fillOpacity="0.55" />
        <rect x="18" y="10" width="4" height="12" rx="2" fill={secondary} fillOpacity="0.55" />
        <rect x="-8" y="29" width="16" height="13" rx="5" fill={dark} />
        <rect x="-5" y="32" width="10" height="7" rx="3" fill={highlight} fillOpacity="0.95" />
        <path d="M 0 -47 L 17 -34 L 25 -7 L 22 21 L 12 40 L 0 47 L -12 40 L -22 21 L -25 -7 L -17 -34 Z" fill="none" stroke={highlight} strokeOpacity="0.48" strokeWidth="1.7" />
      </svg>
    </div>
  );
}

function DroneTile({ skin, role, selected = false, loadout = false, StaticDronePreview }) {
  const resolvedRole = getDroneRole(skin, 0, role);

  return (
    <article className={`store-drone-tile ${selected ? "is-selected" : ""} ${loadout ? "is-loadout" : ""}`}>
      {StaticDronePreview ? (
        <StaticDronePreview
          skin={skin}
          size={loadout ? "tiny" : "tiny"}
          compact={Boolean(loadout)}
        />
      ) : (
        <StoreDroneArtwork skin={skin} role={resolvedRole} compact={loadout} />
      )}
      <span>{resolvedRole}</span>
      <strong>{skin?.name || "Drone"}</strong>
    </article>
  );
}

function PackCard({ pack, type = "regular", selectedDrone, equippedCtfPackId, isGuest, onOpenPack, StaticDronePreview }) {
  const isCtf = type === "ctf";
  const isStarter = Boolean(isCtf && pack?.starter);
  const isSelected = isCtf
    ? equippedCtfPackId === pack.id
    : pack.skins.some((skin) => skin.id === selectedDrone);

  return (
    <article className={`store-pack-card ${isCtf ? "is-ctf" : "is-arena"} ${isSelected ? "is-selected" : ""}`}>
      <div className="store-pack-preview" aria-label={`Drone preview for ${pack.name}`}>
        {pack.skins.map((skin, index) => (
          <DroneTile
            key={skin.id}
            skin={skin}
            role={isCtf ? skin.role : `SKIN ${index + 1}`}
            selected={!isCtf && selectedDrone === skin.id}
            StaticDronePreview={StaticDronePreview}
          />
        ))}
      </div>

      <div className="store-pack-copy">
        <span className="store-pack-type">
          {isCtf
            ? isStarter
              ? "CAPTURE THE FLAG · STARTER LOADOUT"
              : "CAPTURE THE FLAG · ROLE PACK"
            : "ARENA · PREMIUM SKIN PACK"}
        </span>
        <h3>{pack.name}</h3>
        <p>{pack.subtitle}</p>
      </div>

      <div className="store-pack-footer">
        <strong>{pack.price}</strong>
        <button
          className={`${isGuest && !isStarter ? "is-view-only" : ""} ${isStarter ? "is-starter-pack" : ""}`}
          onClick={() => onOpenPack?.(pack.id)}
        >
          {isGuest
            ? isStarter
              ? "ACTIVE LOADOUT"
              : "VIEW PACK"
            : isSelected
              ? isCtf
                ? isStarter
                  ? "STARTER EQUIPPED"
                  : "EQUIPPED"
                : "SELECTED"
              : isStarter
                ? "USE STARTER"
                : "OPEN PACK"}
        </button>
      </div>
    </article>
  );
}

function Shop({
  regularPacks = [],
  ctfPacks = [],
  onOpenPack,
  selectedDrone,
  equippedCtfPackId,
  isGuest = false,
  StaticDronePreview,
}) {
  return (
    <section className="shop-page">
      <section className="store-collection-section">
        <header className="store-section-heading">
          <div>
            <span>ARENA PACKS</span>
            <h2>33 Arena Drone Skins</h2>
          </div>
          <p>Each pack includes four premium chassis configurations for the main arena drone, built to carry the same visual identity across every standard mode.</p>
        </header>

        <div className="store-pack-grid">
          {regularPacks.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              selectedDrone={selectedDrone}
              equippedCtfPackId={equippedCtfPackId}
              isGuest={isGuest}
              onOpenPack={onOpenPack}
              StaticDronePreview={StaticDronePreview}
            />
          ))}
        </div>
      </section>

      <div className="store-ctf-divider" aria-label="Capture The Flag 4v4 section">
        <span className="store-ctf-divider-line" />
        <div>
          <small>MULTIPLAYER CLASS LOADOUTS</small>
          <strong>CAPTURE THE FLAG · 4V4</strong>
          <p>Eight premium 4v4 collections begin here. Every pack delivers a role-specific Attack, Tank, and Defender formation built for objective pressure and team control.</p>
        </div>
        <span className="store-ctf-divider-line" />
      </div>

      <section className="store-collection-section store-ctf-section">
        <header className="store-section-heading">
          <div>
            <span>CTF CLASS PACKS</span>
            <h2>Attack · Tank · Defender</h2>
          </div>
          <p>Every collection unlocks a matched Attack, Tank, and Defender trio with a distinct high-detail hull language, from stealth military frames to solar and ronin command rigs.</p>
        </header>

        <div className="store-pack-grid">
          {ctfPacks.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              type="ctf"
              selectedDrone={selectedDrone}
              equippedCtfPackId={equippedCtfPackId}
              isGuest={isGuest}
              onOpenPack={onOpenPack}
              StaticDronePreview={StaticDronePreview}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

export default Shop;
