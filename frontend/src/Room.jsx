import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import "./Room.css";

export default function Room({ roomId, username }) {
  const playerRef = useRef(null);
  const isSyncingRef = useRef(false);

  const [isPlayerReady, setIsPlayerReady] = useState(false); // ✅ FIX
  const [participants, setParticipants] = useState({});
  const [videoId, setVideoId] = useState("");
  const [role, setRole] = useState("");
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState("");

  /* ================= SYNC ================= */
  const handleSync = (s) => {
    console.log("🔥 SYNC RECEIVED", s);

    setParticipants(s.participants);
    setChat(s.messages);

    const me = Object.values(s.participants).find(
  (p) => p.username === username
);
    if (me) {
      console.log("🎯 ROLE:", me.role);
      setRole(me.role);
    }

    // ❌ WAIT until player ready
    if (!playerRef.current || !isPlayerReady) return;

    isSyncingRef.current = true;

    playerRef.current.loadVideoById(s.videoId);

    setTimeout(() => {
      playerRef.current.seekTo(s.currentTime);

      if (s.playState === "play") {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }

      isSyncingRef.current = false;
    }, 500);
  };

  /* ================= YT PLAYER ================= */
  useEffect(() => {
    if (playerRef.current) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player("player", {
        height: "400",
        width: "100%",
        videoId: "",
        playerVars: {
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            console.log("🎬 Player Ready");
            setIsPlayerReady(true); // ✅ FIX
          },

          onStateChange: (e) => {
            if (!playerRef.current) return;
            if (role === "participant") return;
            if (isSyncingRef.current) return;

            const time = playerRef.current.getCurrentTime();

            if (e.data === 1) {
              socket.emit("play", { roomId, time });
            }

            if (e.data === 2) {
              socket.emit("pause", { roomId, time });
            }
          },
        },
      });
    };
  }, []);

  /* ================= SOCKET ================= */
  useEffect(() => {
  if (!roomId || !username) return;

  socket.disconnect(); // ✅ reset
  socket.connect();    // ✅ fresh connect

  socket.on("connect", () => {
    console.log("✅ CONNECTED:", socket.id);
    socket.emit("join_room", { roomId, username });
  });

  socket.on("sync_state", (s) => {
    if (!isPlayerReady) return;
    handleSync(s);
  });

  socket.on("play", (t) => {
    if (!playerRef.current) return;
    isSyncingRef.current = true;
    playerRef.current.seekTo(t);
    playerRef.current.playVideo();
    setTimeout(() => (isSyncingRef.current = false), 300);
  });

  socket.on("pause", (t) => {
    if (!playerRef.current) return;
    isSyncingRef.current = true;
    playerRef.current.seekTo(t);
    playerRef.current.pauseVideo();
    setTimeout(() => (isSyncingRef.current = false), 300);
  });

  socket.on("change_video", (id) => {
    if (!playerRef.current) return;
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

  return () => {
    socket.off();
  };
}, [roomId, username, isPlayerReady]);
  /* ================= ACTIONS ================= */
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

  /* ================= UI ================= */
  return (
    <div className="room-container">
      <div className="video-section">
        <h2>🎬 Room: {roomId}</h2>

        <h3>
          Your Role: <span>{role}</span>
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
          <div key={id}>
            {p.username} ({p.role})
          </div>
        ))}
      </div>

      <div className="chat-section">
        <h3>💬 Chat</h3>

        <div>
          {chat.map((c, i) => (
            <div key={i}>
              <b>{c.username}</b>: {c.text}
            </div>
          ))}
        </div>

        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Type message..."
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}