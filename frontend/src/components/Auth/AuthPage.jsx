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

function AuthPage() {
  const googleLogin = () => {
    window.location.href = `${API}/auth/google`;
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

        <p className="login-note">
          Contul tau se creeaza automat si primesti drona Basic gratuit.
        </p>
      </div>
    </div>
  );
}

export default AuthPage;