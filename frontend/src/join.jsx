import { useState } from "react";
import "./Join.css";

export default function Join({ onJoin }) {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");

  const handleJoin = () => {
    if (!username || !roomId) return;
    onJoin({ username, roomId });
  };

  return (
    <div className="join-container">
      <div className="join-box">
        <h2>🎬 Watch Party</h2>

        <input
          className="join-input"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="join-input"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />

        <button className="join-btn" onClick={handleJoin}>
          Join Room
        </button>
      </div>
    </div>
  );
}