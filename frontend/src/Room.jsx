import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "./socket";
import "./Room.css";

/* ─── Isolated player wrapper – never re-renders ─── */
function YouTubePlayer({ onReady, onStateChange }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const initPlayer = () => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "400",
        width: "100%",
        videoId: "",
        playerVars: { origin: window.location.origin },
        events: {
          onReady: () => onReady(playerRef.current),
          onStateChange,
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer(); // API already loaded
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    }
  }, []); // empty deps — runs once, never re-runs

  // containerRef div is NEVER touched by React after mount
  return <div ref={containerRef} />;
}

/* ─── Main Room component ─── */
export default function Room({ roomId, username }) {
  const playerRef = useRef(null);       // holds YT player instance
  const isSyncingRef = useRef(false);
  const roleRef = useRef("");
  const pendingSyncRef = useRef(null);  // store sync if player not ready yet

  const [participants, setParticipants] = useState({});
  const [videoId, setVideoId] = useState("");
  const [role, setRole] = useState("");
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState("");

  const setRoleBoth = (r) => {
    setRole(r);
    roleRef.current = r;
  };

  /* ── Apply sync state to player ── */
  const applySync = useCallback((s, player) => {
    if (!player) return;
    isSyncingRef.current = true;
    player.loadVideoById({
      videoId: s.videoId,
      startSeconds: s.currentTime,
    });
    // loadVideoById auto-plays; pause if needed
    setTimeout(() => {
      if (s.playState !== "play") {
        player.pauseVideo();
        player.seekTo(s.currentTime, true);
      }
      isSyncingRef.current = false;
    }, 800);
  }, []);

  /* ── Called by YouTubePlayer when ready ── */
  const handlePlayerReady = useCallback((player) => {
    console.log("Player Ready");
    playerRef.current = player;
    // if sync arrived before player was ready, apply it now
    if (pendingSyncRef.current) {
      applySync(pendingSyncRef.current, player);
      pendingSyncRef.current = null;
    }
  }, [applySync]);

  /* ── YT state change ── */
  const handleStateChange = useCallback((e) => {
    if (!playerRef.current) return;
    if (roleRef.current === "participant") return;
    if (isSyncingRef.current) return;

    const time = playerRef.current.getCurrentTime();
    if (e.data === 1) socket.emit("play", { roomId, time });
    if (e.data === 2) socket.emit("pause", { roomId, time });
  }, [roomId]);

  /* ── Socket sync_state handler ── */
  const handleSync = useCallback((s) => {
    console.log("SYNC RECEIVED", s);

    // update UI state (these cause re-renders — but YouTubePlayer is isolated)
    setParticipants(s.participants);
    setChat(s.messages || []);

    const me = s.participants[socket.id];
    if (me) setRoleBoth(me.role);

    if (!playerRef.current) {
      // player not ready yet — store sync, apply when ready
      pendingSyncRef.current = s;
      return;
    }
    applySync(s, playerRef.current);
  }, [applySync]);

  /* ── Socket events ── */
  useEffect(() => {
    if (!roomId || !username) return;

    if (!socket.connected) socket.connect();

    socket.on("connect", () => {
      console.log("CONNECTED:", socket.id);
      socket.emit("join_room", { roomId, username });
    });

    socket.on("sync_state", handleSync);

    socket.on("play", (t) => {
      if (!playerRef.current) return;
      isSyncingRef.current = true;
      playerRef.current.seekTo(t, true);
      playerRef.current.playVideo();
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("pause", (t) => {
      if (!playerRef.current) return;
      isSyncingRef.current = true;
      playerRef.current.seekTo(t, true);
      playerRef.current.pauseVideo();
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("seek", (t) => {
      if (!playerRef.current) return;
      isSyncingRef.current = true;
      playerRef.current.seekTo(t, true);
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("change_video", (id) => {
      if (!playerRef.current) return;
      playerRef.current.loadVideoById(id);
    });

    socket.on("user_joined", (d) => setParticipants(d.participants));

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

    return () => { socket.off(); };
  }, [roomId, username, handleSync]);

  /* ── Actions ── */
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

  const assignRole = (userId, newRole) =>
    socket.emit("assign_role", { roomId, userId, role: newRole });

  const removeParticipant = (userId) =>
    socket.emit("remove_participant", { roomId, userId });

  /* ── UI ── */
  return (
    <div className="room-container">
      <div className="video-section">
        <h2>Room: {roomId}</h2>
        <h3>Your Role: <span>{role}</span></h3>

        {(role === "host" || role === "moderator") && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              placeholder="Paste YouTube link"
              onChange={(e) => setVideoId(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={change}>Load Video</button>
          </div>
        )}

        {/*
          YouTubePlayer is a separate component with no props that change
          after mount — React will NEVER re-render or unmount it.
          This is the key fix for the insertBefore crash.
        */}
        <YouTubePlayer
          onReady={handlePlayerReady}
          onStateChange={handleStateChange}
        />

        <h3>Participants</h3>
        {Object.entries(participants).map(([id, p]) => (
          <div key={id} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
            <span>{p.username} ({p.role})</span>
            {role === "host" && id !== socket.id && (
              <>
                <button onClick={() => assignRole(id, "moderator")}>Mod</button>
                <button onClick={() => assignRole(id, "participant")}>Participant</button>
                <button onClick={() => removeParticipant(id)}>Remove</button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="chat-section">
        <h3>Chat</h3>
        <div className="chat-messages">
          {chat.map((c, i) => (
            <div key={i}><b>{c.username}</b>: {c.text}</div>
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