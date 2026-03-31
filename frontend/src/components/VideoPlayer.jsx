import ReactPlayer from "react-player";

function VideoPlayer({ url }) {
  return (
    <div>
      <ReactPlayer url={url} controls />
    </div>
  );
}

export default VideoPlayer;