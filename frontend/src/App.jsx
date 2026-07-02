import { useEffect, useState } from "react";
import AuthPage from "./components/Auth/AuthPage";
import Dashboard from "./components/Dashboard/Dashboard";
import "./styles.css";

function safeParseUser(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function App() {
  // IMPORTANT:
  // Citim doar user-ul real din localStorage.
  // Guest-ul NU se citeste din sessionStorage si NU ramane dupa refresh.
  const savedUser = safeParseUser(localStorage.getItem("user"));

  const [user, setUser] = useState(savedUser ? { ...savedUser, isGuest: false } : null);
  const [screen, setScreen] = useState(savedUser ? "profile" : "auth");
  const [gameMode, setGameMode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const token = params.get("token");
    const userParam = params.get("user");

    if (token && userParam) {
      const googleUser = JSON.parse(decodeURIComponent(userParam));
      const realUser = {
        ...googleUser,
        isGuest: false,
      };

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(realUser));
      sessionStorage.removeItem("droneSwarmGuestUser");

      setUser(realUser);
      setGameMode(null);
      setScreen("profile");

      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const handleAuthSuccess = (loggedUser) => {
    const isGuest = Boolean(loggedUser?.isGuest);

    if (isGuest) {
      const guestUser = {
        ...loggedUser,
        id: null,
        userId: null,
        email: null,
        isGuest: true,
        selectedDrone: "basic",
        selectedSkin: "cyan",
        selectedDroneSkin: "cyan",
        skin: "cyan",
      };

      // Guest-ul NU se salveaza nicaieri permanent.
      // La refresh/inchidere pagina revine automat la AuthPage.
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("droneSwarmGuestUser");

      setUser(guestUser);
    } else {
      const realUser = {
        ...loggedUser,
        isGuest: false,
      };

      localStorage.setItem("user", JSON.stringify(realUser));
      setUser(realUser);
    }

    setGameMode(null);
    setScreen("profile");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("droneSwarmGuestUser");

    setUser(null);
    setGameMode(null);
    setScreen("auth");
  };

  const handleExitToMenu = () => {
    setGameMode(null);
    setScreen(user ? "profile" : "auth");
  };

  const handleUserUpdated = (nextUser) => {
    if (!nextUser || nextUser.isGuest) return;

    const realUser = {
      ...nextUser,
      isGuest: false,
    };

    localStorage.setItem("user", JSON.stringify(realUser));
    setUser(realUser);
  };

  if (screen === "auth" || !user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <Dashboard
      user={user}
      gameMode={gameMode}
      onExitToMenu={handleExitToMenu}
      onLogout={handleLogout}
      onUserUpdated={handleUserUpdated}
    />
  );
}

export default App;
