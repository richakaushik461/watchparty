import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import "./Room.css";

/* ═══════════════════════════════════════════════
   YouTubePlayer — receives NO changing props.
   Communicates only via stable refs passed in.
   React will NEVER re-render this component.
═══════════════════════════════════════════════ */
function YouTubePlayer({ playerRef, isSyncingRef, roleRef, roomId }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // roomId and all refs are stable — this runs exactly once
    const initPlayer = () => {
      if (playerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "400",
        width: "100%",
        videoId: "",
        playerVars: {
          origin: window.location.origin,
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            console.log("Player Ready");
          },
          onStateChange: (e) => {
            if (!playerRef.current) return;
            if (roleRef.current === "participant") return;
            if (isSyncingRef.current) return;

            const time = playerRef.current.getCurrentTime();
            if (e.data === 1) socket.emit("play", { roomId, time });
            if (e.data === 2) socket.emit("pause", { roomId, time });
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    }
  }, []); // ← EMPTY DEPS, runs once only

  return <div ref={containerRef} />;
}

/* ═══════════════════════════════════════════════
   Room — all state lives here, player is isolated
═══════════════════════════════════════════════ */
export default function Room({ roomId, username }) {
  // Shared refs — passed to YouTubePlayer, never cause re-renders
  const playerRef    = useRef(null);
  const isSyncingRef = useRef(false);
  const roleRef      = useRef("");

  // Pending sync — if sync arrives before player ready
  const pendingSyncRef = useRef(null);

  // UI state — these cause re-renders in Room, NOT in YouTubePlayer
  const [participants, setParticipants] = useState({});
  const [videoInputVal, setVideoInputVal] = useState("");
  const [role, setRole]   = useState("");
  const [chat, setChat]   = useState([]);
  const [msg,  setMsg]    = useState("");

  /* ── helper: update role in both state and ref ── */
  const updateRole = (r) => {
    setRole(r);
    roleRef.current = r;
  };

  /* ── apply a sync object to the player ── */
  const applySync = (s) => {
    const player = playerRef.current;
    if (!player) {
      // Player not ready yet — store for later
      pendingSyncRef.current = s;
      return;
    }

    isSyncingRef.current = true;

    // cueVideoById won't autoplay — safer than loadVideoById
    player.cueVideoById({
      videoId: s.videoId,
      startSeconds: s.currentTime,
    });

    setTimeout(() => {
      if (s.playState === "play") {
        player.playVideo();
      } else {
        player.seekTo(s.currentTime, true);
        player.pauseVideo();
      }
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 200);
    }, 600);
  };

  /* ── Socket setup ── */
  useEffect(() => {
    if (!roomId || !username) return;

    if (!socket.connected) socket.connect();

    socket.on("connect", () => {
      console.log("CONNECTED:", socket.id);
      socket.emit("join_room", { roomId, username });
    });

    socket.on("sync_state", (s) => {
      console.log("SYNC RECEIVED", s);

      // Update UI state (re-renders Room but NOT YouTubePlayer)
      setParticipants(s.participants);
      setChat(s.messages || []);

      const me = s.participants[socket.id];
      if (me) updateRole(me.role);

      // Apply to player (uses refs only — safe)
      applySync(s);
    });

    socket.on("play", (t) => {
      const p = playerRef.current;
      if (!p) return;
      isSyncingRef.current = true;
      p.seekTo(t, true);
      p.playVideo();
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("pause", (t) => {
      const p = playerRef.current;
      if (!p) return;
      isSyncingRef.current = true;
      p.seekTo(t, true);
      p.pauseVideo();
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("seek", (t) => {
      const p = playerRef.current;
      if (!p) return;
      isSyncingRef.current = true;
      p.seekTo(t, true);
      setTimeout(() => (isSyncingRef.current = false), 300);
    });

    socket.on("change_video", (id) => {
      const p = playerRef.current;
      if (!p) return;
      p.loadVideoById(id);
    });

    socket.on("user_joined", (d) => setParticipants(d.participants));

    socket.on("role_assigned", (d) => {
      setParticipants(d.participants);
      const me = d.participants[socket.id];
      if (me) updateRole(me.role);
    });

    socket.on("receive_message", (m) =>
      setChat((prev) => [...prev, m])
    );

    socket.on("kicked", () => {
      alert("You have been removed from the room.");
      window.location.reload();
    });

    return () => { socket.off(); };
  }, [roomId, username]); // stable deps

  /* ── Poll for player ready, then apply pending sync ── */
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && pendingSyncRef.current) {
        applySync(pendingSyncRef.current);
        pendingSyncRef.current = null;
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  /* ── Actions ── */
  const send = () => {
    if (!msg.trim()) return;
    socket.emit("send_message", { roomId, username, text: msg });
    setMsg("");
  };

  const changeVideo = () => {
    let id = videoInputVal;
    const m = videoInputVal.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
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
              onChange={(e) => setVideoInputVal(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={changeVideo}>Load Video</button>
          </div>
        )}

        {/*
          Refs are stable objects — passing them as props does NOT
          cause YouTubePlayer to re-render when Room's state changes.
          This is the key fix.
        */}
        <YouTubePlayer
          playerRef={playerRef}
          isSyncingRef={isSyncingRef}
          roleRef={roleRef}
          roomId={roomId}
        />

        <h3>Participants</h3>
        {Object.entries(participants).map(([id, p]) => (
          <div
            key={id}
            style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}
          >
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