import { useEffect, useState } from "react";
import AuthPage from "./components/Auth/AuthPage";
import Dashboard from "./components/Dashboard/Dashboard";
import "./styles.css";

function App() {
  const savedUser = localStorage.getItem("user");

  const [user, setUser] = useState(savedUser ? JSON.parse(savedUser) : null);
  const [screen, setScreen] = useState(savedUser ? "profile" : "auth");
  const [gameMode, setGameMode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const token = params.get("token");
    const userParam = params.get("user");

    if (token && userParam) {
      const googleUser = JSON.parse(decodeURIComponent(userParam));

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(googleUser));

      setUser(googleUser);
      setScreen("profile");

      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const handleAuthSuccess = (loggedUser) => {
    setUser(loggedUser);
    setScreen("profile");
  };

  const handleExitToMenu = () => {
    setGameMode(null);
    setScreen("profile");
  };

  if (screen === "auth") {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <Dashboard
      user={user}
      gameMode={gameMode}
      onExitToMenu={handleExitToMenu}
    />
  );
}

export default App;