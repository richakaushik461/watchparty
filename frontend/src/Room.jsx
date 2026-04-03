import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import "./Room.css";

export default function Room({ roomId, username }) {
  const playerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const roleRef = useRef("");           // FIX: ref to avoid stale closure
  const isPlayerReadyRef = useRef(false); // FIX: ref to avoid stale closure

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [participants, setParticipants] = useState({});
  const [videoId, setVideoId] = useState("");
  const [role, setRole] = useState("");
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState("");

  /* ================= HELPER ================= */
  const setRoleBoth = (r) => {
    setRole(r);
    roleRef.current = r; // keep ref in sync with state
  };

  /* ================= SYNC ================= */
  const handleSync = (s) => {
    console.log("SYNC RECEIVED", s);

    setParticipants(s.participants);
    setChat(s.messages || []);

    const me = s.participants[socket.id];
    if (me) {
      console.log("ROLE:", me.role);
      setRoleBoth(me.role); // FIX: update both state and ref
    }

    // FIX: use ref instead of state — state is stale inside this closure
    if (!playerRef.current || !isPlayerReadyRef.current) return;

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
      // FIX: pass string id "yt-player" instead of DOM ref
      // This prevents the insertBefore crash
      playerRef.current = new window.YT.Player("yt-player", {
        height: "400",
        width: "100%",
        videoId: "",
        playerVars: {
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            console.log("Player Ready");
            setIsPlayerReady(true);
            isPlayerReadyRef.current = true; // FIX: update ref
          },
          onStateChange: (e) => {
            if (!playerRef.current) return;
            if (roleRef.current === "participant") return; // FIX: use ref not state
            if (isSyncingRef.current) return;

            const time = playerRef.current.getCurrentTime();

            if (e.data === window.YT.PlayerState.PLAYING) {
              socket.emit("play", { roomId, time });
            }
            if (e.data === window.YT.PlayerState.PAUSED) {
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

    if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", () => {
      console.log("CONNECTED:", socket.id);
      socket.emit("join_room", { roomId, username });
    });

    socket.on("sync_state", handleSync);

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

    socket.on("seek", (t) => {
      if (!playerRef.current) return;
      isSyncingRef.current = true;
      playerRef.current.seekTo(t);
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("change_video", (id) => {
      if (!playerRef.current) return;
      playerRef.current.loadVideoById(id);
    });

    socket.on("user_joined", (d) => setParticipants(d.participants));

    // FIX: also update own role when role_assigned fires
    socket.on("role_assigned", (d) => {
      setParticipants(d.participants);
      const me = d.participants[socket.id];
      if (me) setRoleBoth(me.role);
    });

    socket.on("receive_message", (m) =>
      setChat((prev) => [...prev, m])
    );

    socket.on("kicked", () => {
      alert("You have been removed from the room.");
      window.location.reload();
    });

    return () => {
      socket.off();
    };
  }, [roomId, username]);

  /* ================= ACTIONS ================= */
  const send = () => {
    if (!msg.trim()) return;
    socket.emit("send_message", { roomId, username, text: msg });
    setMsg("");
  };

  const change = () => {
    let id = videoId;
    const m = videoId.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    if (m) id = m[1];
    socket.emit("change_video", { roomId, videoId: id });
  };

  const assignRole = (userId, newRole) => {
    socket.emit("assign_role", { roomId, userId, role: newRole });
  };

  const removeParticipant = (userId) => {
    socket.emit("remove_participant", { roomId, userId });
  };

  /* ================= UI ================= */
  return (
    <div className="room-container">
      <div className="video-section">
        <h2>Room: {roomId}</h2>
        <h3>Your Role: <span>{role}</span></h3>

        {/* Only host/moderator can change video */}
        {(role === "host" || role === "moderator") && (
          <>
            <input
              placeholder="Paste YouTube link"
              onChange={(e) => setVideoId(e.target.value)}
            />
            <button onClick={change}>Load Video</button>
          </>
        )}

        {/* FIX: plain div with id="yt-player" — no ref, no DOM manipulation conflict */}
        <div id="yt-player"></div>

        <h3>Participants</h3>
        {Object.entries(participants).map(([id, p]) => (
          <div key={id} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span>{p.username} ({p.role})</span>

            {/* Host controls: assign role / remove */}
            {role === "host" && id !== socket.id && (
              <>
                <button onClick={() => assignRole(id, "moderator")}>
                  Make Moderator
                </button>
                <button onClick={() => assignRole(id, "participant")}>
                  Make Participant
                </button>
                <button onClick={() => removeParticipant(id)}>
                  Remove
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="chat-section">
        <h3>Chat</h3>
        <div className="chat-messages">
          {chat.map((c, i) => (
            <div key={i}>
              <b>{c.username}</b>: {c.text}
            </div>
          ))}
        </div>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type message..."
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}