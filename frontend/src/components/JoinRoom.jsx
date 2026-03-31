import { useState } from "react";
import { useNavigate } from "react-router-dom";

function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const joinRoom = () => {
    navigate("/room/" + roomId);
  };

  return (
    <div>
      <h2>Join Room</h2>
      <input
        placeholder="Enter Room ID"
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={joinRoom}>Join</button>
    </div>
  );
}

export default JoinRoom;