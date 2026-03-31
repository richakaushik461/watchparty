import { useParams } from "react-router-dom";
import ReactPlayer from "react-player";

function Room() {
  const { id } = useParams();

  return (
    <div className="room-container">
      <h2>Room ID: {id}</h2>

      <ReactPlayer
        url="https://www.youtube.com/watch?v=ysz5S6PUM-U"
        controls
        width="100%"
      />
    </div>
  );
}

export default Room;