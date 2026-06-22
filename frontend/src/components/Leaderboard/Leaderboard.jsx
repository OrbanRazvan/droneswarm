import './Leaderboard.css';

function Leaderboard({ players }) {
  const sortedPlayers = [...players]
    .sort((a, b) => b.mass - a.mass)
    .slice(0, 5);

  return (
    <div className="leaderboard">
      <h3>LEADERBOARD</h3>

      {sortedPlayers.map((player, index) => (
        <div key={player.id} className="leaderboard-row">
          <span>{index + 1}. {player.username}</span>
          <strong>{player.mass}</strong>
        </div>
      ))}
    </div>
  );
}

export default Leaderboard;