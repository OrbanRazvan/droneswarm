import { useState } from "react";
import "./AuthPage.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

function MenuDrone({ className = "" }) {
  return (
    <div className={`menu-drone-model ${className}`}>
      <div className="menu-arm menu-arm-x" />
      <div className="menu-arm menu-arm-y" />

      <div className="menu-rotor menu-rotor-tl"><span /></div>
      <div className="menu-rotor menu-rotor-tr"><span /></div>
      <div className="menu-rotor menu-rotor-bl"><span /></div>
      <div className="menu-rotor menu-rotor-br"><span /></div>

      <div className="menu-shell" />
      <div className="menu-camera" />
      <div className="menu-light" />
    </div>
  );
}

function normalizeGuestName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 16);
}

function createGuestUser(username) {
  const cleanName =
    normalizeGuestName(username) || `Guest${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    id: null,
    userId: null,
    isGuest: true,
    firstName: "Guest",
    lastName: "",
    username: cleanName,
    email: null,
    selectedDrone: "basic",
    selectedSkin: "cyan",
    selectedDroneSkin: "cyan",
    skin: "cyan",
    avatar: null,
  };
}

function AuthPage({ onAuthSuccess, onLogin, onGuestLogin }) {
  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState("");

  const googleLogin = () => {
    window.location.href = `${API}/auth/google`;
  };

  const playAsGuest = () => {
    const cleanName = normalizeGuestName(guestName);

    if (cleanName.length < 3) {
      setGuestError("Numele trebuie sa aiba minimum 3 caractere.");
      return;
    }

    const guestUser = createGuestUser(cleanName);

    // Guest-ul nu se salveaza in localStorage/sessionStorage.
    // La refresh, pagina se intoarce automat la AuthPage.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("droneSwarmGuestUser");

    if (typeof onAuthSuccess === "function") {
      onAuthSuccess(guestUser);
      return;
    }

    if (typeof onGuestLogin === "function") {
      onGuestLogin(guestUser);
      return;
    }

    if (typeof onLogin === "function") {
      onLogin({ token: null, user: guestUser, isGuest: true });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-grid" />

      <MenuDrone className="floating-drone drone-a" />
      <MenuDrone className="floating-drone drone-b" />
      <MenuDrone className="floating-drone drone-c" />

      <div className="auth-card">
        <MenuDrone />

        <h1>DRONE SWARM</h1>

        <p className="subtitle">
          Command your drone fleet. Collect energy. Dominate the arena.
        </p>

        <button className="google-btn" onClick={googleLogin}>
          <span className="google-icon">G</span>
          Continua cu Google
        </button>

        <div className="guest-divider">
          <span />
          <b>SAU</b>
          <span />
        </div>

        <div className="guest-login-box">
          <label htmlFor="guest-name">Play as Guest</label>

          <input
            id="guest-name"
            value={guestName}
            maxLength={16}
            autoComplete="off"
            placeholder="Alege un nume"
            onChange={(event) => {
              setGuestName(event.target.value);
              setGuestError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                playAsGuest();
              }
            }}
          />

          {guestError ? <small className="guest-error">{guestError}</small> : null}

          <button className="guest-btn" onClick={playAsGuest}>
            Intra ca Guest
          </button>
        </div>

        <p className="login-note">
          Cu Google se salveaza progresul. Ca Guest poti intra in joc, dar istoricul nu se salveaza.
        </p>
      </div>
    </div>
  );
}

export default AuthPage;
