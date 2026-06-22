import './PlayerStats.css';

function PlayerStats({ mass, drones }) {
  return (
    <div className="player-stats">
      <div>MASS: {mass}</div>
      <div className="cyan">DRONES: {drones}</div>
    </div>
  );
}

export default PlayerStats;