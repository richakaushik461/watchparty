import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import "./Room.css"; // ✅ ADD THIS

export default function Room({ roomId, username }) {
  const playerRef = useRef(null);
  const isSyncingRef = useRef(false);

  const [participants, setParticipants] = useState({});
  const [videoId, setVideoId] = useState("");
  const [role, setRole] = useState("");
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState("");

  /* YT PLAYER */
  useEffect(() => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player("player", {
        height: "400",
        width: "100%",
        videoId: "",
        events: {
          onStateChange: (e) => {
            if (!playerRef.current) return;
            if (role === "participant") return;
            if (isSyncingRef.current) return;

            const time = playerRef.current.getCurrentTime();

            if (e.data === 1)
              socket.emit("play", { roomId, time });
            if (e.data === 2)
              socket.emit("pause", { roomId, time });
          },
        },
      });
    };
  }, []);

  /* SOCKET */
  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      socket.emit("join_room", { roomId, username });
    });

    socket.on("sync_state", (s) => {
      setParticipants(s.participants);
      setChat(s.messages);

      const me = s.participants[socket.id];
      if (me) setRole(me.role);

      isSyncingRef.current = true;

      playerRef.current.loadVideoById(s.videoId);

      setTimeout(() => {
        playerRef.current.seekTo(s.currentTime);
        s.playState === "play"
          ? playerRef.current.playVideo()
          : playerRef.current.pauseVideo();

        isSyncingRef.current = false;
      }, 500);
    });

    socket.on("play", (t) => {
      isSyncingRef.current = true;
      playerRef.current.seekTo(t);
      playerRef.current.playVideo();
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("pause", (t) => {
      isSyncingRef.current = true;
      playerRef.current.seekTo(t);
      playerRef.current.pauseVideo();
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("change_video", (id) => {
      playerRef.current.loadVideoById(id);
    });

    socket.on("user_joined", (d) => setParticipants(d.participants));
    socket.on("role_assigned", (d) => setParticipants(d.participants));
    socket.on("receive_message", (m) =>
      setChat((p) => [...p, m])
    );

    socket.on("kicked", () => {
      alert("Removed");
      window.location.reload();
    });

    return () => socket.disconnect();
  }, []);

  /* ACTIONS */
  const send = () => {
    if (!msg.trim()) return;

    socket.emit("send_message", {
      roomId,
      username,
      text: msg,
    });
    setMsg("");
  };

  const change = () => {
    let id = videoId;
    const m = videoId.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    if (m) id = m[1];

    socket.emit("change_video", { roomId, videoId: id });
  };

  return (
    <div className="room-container">
      
      {/* LEFT SIDE */}
      <div className="video-section">
        <h2>🎬 Room: {roomId}</h2>
        <h3>
          Your Role:{" "}
          <span className={`role-${role}`}>{role}</span>
        </h3>

        {role === "host" && (
          <>
            <input
              placeholder="Paste YouTube link"
              onChange={(e) => setVideoId(e.target.value)}
            />
            <button onClick={change}>Load Video</button>
          </>
        )}

        <div id="player"></div>

        <h3>👥 Participants</h3>

        {Object.entries(participants).map(([id, p]) => (
          <div className="participant" key={id}>
            <span>
              {p.username} (
              <span className={`role-${p.role}`}>{p.role}</span>)
            </span>

            {role === "host" && id !== socket.id && (
              <>
                <button
                  onClick={() =>
                    socket.emit("assign_role", {
                      roomId,
                      userId: id,
                      role: "moderator",
                    })
                  }
                >
                  Mod
                </button>

                <button
                  onClick={() =>
                    socket.emit("assign_role", {
                      roomId,
                      userId: id,
                      role: "participant",
                    })
                  }
                >
                  User
                </button>

                <button
                  onClick={() =>
                    socket.emit("remove_participant", {
                      roomId,
                      userId: id,
                    })
                  }
                >
                  Remove
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* RIGHT SIDE CHAT */}
      <div className="chat-section">
        <h3>💬 Chat</h3>

        <div className="chat-box">
          {chat.map((c, i) => (
            <div key={i} className="chat-message">
              <b>{c.username}</b>
              <div>{c.text}</div>
              <small>
                {c.time
                  ? new Date(c.time).toLocaleTimeString()
                  : ""}
              </small>
            </div>
          ))}
        </div>

        <div className="chat-input">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Type message..."
          />
          <button onClick={send}>Send</button>
        </div>
      </div>

    </div>
  );
}