import { useMemo, useState } from "react";
import axios from "axios";
import Shop from "../Shop/Shop";
import "./ProfilePage.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
};

function makeColors(themeId) {
  const theme = SKIN_THEMES[themeId] || SKIN_THEMES.cyan;

  return {
    primary: theme[0],
    secondary: theme[1],
    dark: theme[2],
    light: theme[3],
    glow: theme[4],
  };
}

const BASIC_DRONE = {
  id: "basic",
  themeId: "cyan",
  skin: "cyan",
  name: "Basic Drone",
  type: "Starter",
  price: "OWNED",
  unlocked: true,
  description: "Drona de baza, stabila si usor de controlat.",
  details:
    "Basic Drone este prima drona disponibila pentru fiecare jucator. Este construita pentru control simplu, vizibilitate buna in arena si performanta echilibrata.",
  colors: makeColors("cyan"),
  stats: {
    control: 92,
    speed: 78,
    attack: 70,
    defense: 72,
  },
};

function makeSkin(themeId, name) {
  return {
    id: themeId,
    themeId,
    skin: themeId,
    name,
    type: "Premium",
    unlocked: true,
    colors: makeColors(themeId),
    price: "€2.99",
    description: "Skin premium complet pentru corp, elice, mini drona si drona de atac.",
    details:
      "Skin premium complet pentru arena. Include corp, elice, o mini drona si drona de atac in aceeasi tema vizuala.",
    stats: BASIC_DRONE.stats,
  };
}

export const PREMIUM_PACKS = [
  {
    id: "neon-storm",
    name: "Neon Storm Pack",
    price: "€2.99",
    subtitle: "4 drone luminoase, rapide vizual si curate pentru arena.",
    skins: [
      makeSkin("solar-gold", "Solar Gold"),
      makeSkin("cyber-yellow", "Cyber Yellow"),
      makeSkin("neon-teal", "Neon Teal"),
      makeSkin("arctic-silver", "Arctic Silver"),
    ],
  },
  {
    id: "chaos-rift",
    name: "Chaos Rift Pack",
    price: "€2.99",
    subtitle: "4 drone agresive, dark si foarte vizibile in lupta.",
    skins: [
      makeSkin("void-purple", "Void Purple"),
      makeSkin("crimson-white", "Crimson White"),
      makeSkin("inferno-orange", "Inferno Orange"),
      makeSkin("toxic-lime", "Toxic Lime"),
    ],
  },
];

function MiniDroneModel() {
  return (
    <div className="pdp-mini-drone">
      <div className="pdp-mini-arm pdp-mini-arm-a" />
      <div className="pdp-mini-arm pdp-mini-arm-b" />
      <div className="pdp-mini-rotor pdp-mini-tl" />
      <div className="pdp-mini-rotor pdp-mini-tr" />
      <div className="pdp-mini-rotor pdp-mini-bl" />
      <div className="pdp-mini-rotor pdp-mini-br" />
      <div className="pdp-mini-body" />
      <div className="pdp-mini-light" />
    </div>
  );
}

function DronePreview({ drone = BASIC_DRONE, size = "normal", mini = true }) {
  const colors = drone.colors || BASIC_DRONE.colors;

  return (
    <div
      className={`profile-drone-preview profile-drone-preview-${size}`}
      style={{
        "--p": colors.primary,
        "--s": colors.secondary,
        "--d": colors.dark,
        "--l": colors.light,
        "--g": colors.glow,
      }}
    >
      <div className="pdp-aura" />

      <div className="pdp-arm pdp-arm-a" />
      <div className="pdp-arm pdp-arm-b" />

      <div className="pdp-rotor pdp-tl"><span /></div>
      <div className="pdp-rotor pdp-tr"><span /></div>
      <div className="pdp-rotor pdp-bl"><span /></div>
      <div className="pdp-rotor pdp-br"><span /></div>

      <div className="pdp-body">
        <i />
        <b />
      </div>

      {mini && <MiniDroneModel />}
    </div>
  );
}

function StatBar({ label, value }) {
  return (
    <div className="profile-stat-row">
      <span>{label}</span>
      <div><i style={{ width: `${value}%` }} /></div>
      <b>{value}</b>
    </div>
  );
}

function DroneDetailsModal({ drone, onClose, onSelect }) {
  if (!drone) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="drone-modal clean-drone-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-preview clean-modal-preview">
          <DronePreview drone={drone} size="modal" />
        </div>

        <div className="modal-content">
          <span className="modal-type">{drone.type}</span>
          <h2>{drone.name}</h2>
          <p>{drone.details}</p>

          <div className="modal-stats">
            {Object.entries(drone.stats || BASIC_DRONE.stats).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <button
            className={drone.unlocked ? "primary-play" : "buy-btn modal-buy"}
            onClick={() => drone.unlocked && onSelect(drone)}
          >
            {drone.unlocked ? "SELECT DRONE" : drone.price}
          </button>
        </div>
      </div>
    </div>
  );
}

function PackOpenModal({ pack, onClose, onSelectSkin, selectedDrone }) {
  if (!pack) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pack-open-modal professional-pack-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close pack-close" onClick={onClose}>×</button>

        <div className="pack-modal-top">
          <div>
            <span className="modal-type">Premium Pack</span>
            <h2>{pack.name}</h2>
            <p>{pack.subtitle}</p>
          </div>

          <div className="pack-price-box">
            <span>PRICE</span>
            <strong>{pack.price}</strong>
          </div>
        </div>

        <div className="pack-drones-grid">
          {pack.skins.map((skin) => (
            <article
              key={skin.id}
              className={`pack-drone-card ${selectedDrone === skin.id ? "selected-pack-drone" : ""}`}
            >
              <button
                className="select-skin-button"
                onClick={() => {
                  onSelectSkin(skin);
                  onClose();
                }}
              >
                {selectedDrone === skin.id ? "SELECTED" : "SELECT"}
              </button>

              <DronePreview drone={skin} size="pack" />
              <span>Premium Skin</span>
              <h3>{skin.name}</h3>
              <p>Full drone visual set pentru arena.</p>
            </article>
          ))}
        </div>

        <div className="pack-modal-footer">
          <span>Include 4 drone complete, fiecare cu o mini drona in acelasi skin.</span>
          <button className="primary-play">BUY PACK {pack.price}</button>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ user, setUser, onPlay, onLogout }) {
  const [selectedDrone, setSelectedDrone] = useState(user.selectedDrone || "basic");
  const [activeTab, setActiveTab] = useState("hangar");
  const [detailsDrone, setDetailsDrone] = useState(null);
  const [openedPackId, setOpenedPackId] = useState(null);
  const [usernameInput, setUsernameInput] = useState(user.username || "");
  const [usernameMessage, setUsernameMessage] = useState("");

  const droneCollection = useMemo(
    () => [BASIC_DRONE, ...PREMIUM_PACKS.flatMap((pack) => pack.skins)],
    []
  );

  const selected = useMemo(
    () => droneCollection.find((d) => d.id === selectedDrone) || BASIC_DRONE,
    [selectedDrone, droneCollection]
  );

  const openedPack = useMemo(
    () => PREMIUM_PACKS.find((pack) => pack.id === openedPackId),
    [openedPackId]
  );

  const saveUsername = async () => {
    try {
      const res = await axios.post(`${API}/auth/set-username`, {
        userId: user.id,
        username: usernameInput,
      });

      setUser(res.data.user);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUsernameMessage("");
    } catch (err) {
      setUsernameMessage(err.response?.data?.message || "Username invalid.");
    }
  };

const selectDrone = async (drone) => {
  try {
    const res = await axios.post(`${API}/auth/select-drone`, {
      userId: user.id,
      drone: drone.id,
    });

    const updatedUser = res.data.user || {
      ...user,
      selectedDrone: drone.id,
      selectedSkin: drone.id === "basic" ? "cyan" : drone.id,
    };

    setSelectedDrone(updatedUser.selectedDrone || drone.id);
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  } catch (error) {
    console.error(error);
  }
};

  return (
    <div className="profile-page profile-page-clean">
      <div className="profile-bg-grid" />

      <div className="profile-shell">
        <header className="topbar">
          <div>
            <h1>DRONE SWARM</h1>
            <p>
              Hangar pentru{" "}
              <strong>{user.username || `${user.firstName || ""} ${user.lastName || ""}`}</strong>
            </p>
          </div>

          <div className="top-actions">
            <button className="ghost-btn" onClick={() => setActiveTab("shop")}>Shop</button>
            <button className="logout-btn" onClick={onLogout}>Logout</button>
          </div>
        </header>

        <main className="profile-content">
          <aside className="pilot-panel">
            <div className="pilot-avatar">
              {user.avatar ? (
                <img src={user.avatar} alt="avatar" />
              ) : (
                <span>
                  {user.firstName?.[0] || user.username?.[0] || "P"}
                  {user.lastName?.[0] || ""}
                </span>
              )}
            </div>

            <h2>{user.username || `${user.firstName || ""} ${user.lastName || ""}`}</h2>
            <p className="pilot-email">{user.email}</p>

            <div className="pilot-rank">
              <span>Rank</span>
              <strong>Rookie Pilot</strong>
            </div>

            <div className="pilot-stats-grid">
              <div>
                <span>Drone</span>
                <strong>{selected.name}</strong>
              </div>
              <div>
                <span>Coins</span>
                <strong>0</strong>
              </div>
              <div>
                <span>Owned</span>
                <strong>1 / {droneCollection.length}</strong>
              </div>
              <div>
                <span>Server</span>
                <strong>EU</strong>
              </div>
            </div>

            <div className="game-mode-buttons">
              <button className="play-sidebar-btn" onClick={() => onPlay("ai")}>
                PLAY VS AI
              </button>

              <button className="pvp-sidebar-btn" onClick={() => onPlay("pvp")}>
                PVP MODE
              </button>
            </div>
          </aside>

          <section className="hangar-panel">
            <nav className="hangar-tabs">
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
            </nav>

            {activeTab === "hangar" && (
              <>
                <div className="hero-preview hero-preview-clean">
                  <div className="hero-info">
                    <span className="tag">{selected.type}</span>
                    <h2>{selected.name}</h2>
                    <p>{selected.description}</p>

                    <div className="hero-buttons">
                      <button onClick={() => selectDrone(selected)} className="primary-play">
                        SELECT DRONE
                      </button>

                      <button onClick={() => onPlay("ai")} className="secondary-btn">
                        PLAY VS AI
                      </button>

                      <button className="secondary-btn" onClick={() => setDetailsDrone(selected)}>
                        Detalii drona
                      </button>
                    </div>
                  </div>

                  <div className="hero-drone-stage">
                    <DronePreview drone={selected} size="hero" />
                  </div>
                </div>

                <section className="basic-drone-info-panel">
                  <div>
                    <h2>Basic Drone Details</h2>
                    <p>
                      Basic Drone este drona gratuita. Mai tarziu poti lega sistemul de
                      customizare pentru corp, elice, mini drona si drona de atac.
                    </p>
                  </div>

                  <div className="profile-stats-box">
                    {Object.entries(BASIC_DRONE.stats).map(([key, value]) => (
                      <StatBar key={key} label={key} value={value} />
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeTab === "shop" && (
              <Shop
                packs={PREMIUM_PACKS}
                onOpenPack={(packId) => setOpenedPackId(packId)}
                onSelectSkin={selectDrone}
                selectedDrone={selectedDrone}
                DronePreview={DronePreview}
              />
            )}
          </section>
        </main>

        {!user.username && (
          <div className="username-modal-backdrop">
            <div className="username-modal">
              <h2>Alege numele de jucator</h2>
              <p>Acest nume va fi vizibil in arena, deasupra dronei tale.</p>

              <input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Ex: RazvanPilot"
                maxLength={16}
              />

              <button onClick={saveUsername}>Adauga nume</button>

              {usernameMessage && <span>{usernameMessage}</span>}
            </div>
          </div>
        )}
      </div>

      <DroneDetailsModal
        drone={detailsDrone}
        onClose={() => setDetailsDrone(null)}
        onSelect={selectDrone}
      />

      <PackOpenModal
        pack={openedPack}
        onClose={() => setOpenedPackId(null)}
        onSelectSkin={selectDrone}
        selectedDrone={selectedDrone}
      />
    </div>
  );
}

export default ProfilePage;
