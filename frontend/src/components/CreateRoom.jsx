import { useNavigate } from "react-router-dom";

function CreateRoom() {
  const navigate = useNavigate();

  const createRoom = () => {
    const roomId = Math.random().toString(36).substring(2, 7);
    navigate("/room/" + roomId);
  };

  return (
    <div>
      <h2>Create Watch Party</h2>
      <button onClick={createRoom}>Create Room</button>
    </div>
  );
}

export default CreateRoom;