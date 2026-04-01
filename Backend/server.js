require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const connectDB = require("./db");
const Room = require("./models/Room");
const Message = require("./models/Message");
console.log("ENV CHECK:", process.env.MONGO_URI);

const app = express();
app.use(cors());

connectDB();
app.get("/", (req, res) => {
  res.send("Watch Party Backend Running 🚀");
});
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://watchparty-green.vercel.app",
    methods: ["GET", "POST"],
  }
});

const PORT = 5000;

/* ========================= SOCKET ========================= */
io.on("connection", (socket) => {
  console.log("User:", socket.id);

  const getUser = (room, id) =>
    room.participants.find((p) => p.userId === id);

  const canControl = (user) =>
    user && (user.role === "host" || user.role === "moderator");

  /* JOIN ROOM */
  socket.on("join_room", async ({ roomId, username }) => {
    socket.join(roomId);

    let room = await Room.findOne({ roomId });

    if (!room) {
      room = await Room.create({
        roomId,
        hostId: socket.id,
        participants: [
          { userId: socket.id, username, role: "host" }
        ],
        videoState: {
          videoId: "dQw4w9WgXcQ",
          currentTime: 0,
          isPlaying: false
        }
      });
    } else {
      // remove old entry of same username
room.participants = room.participants.filter(
  (p) => p.username !== username
);

// add fresh user
room.participants.push({
  userId: socket.id,
  username,
  role: room.participants.length === 0 ? "host" : "participant"
});

      if (!room.participants.find((p) => p.role === "host")) {
        room.participants[0].role = "host";
        room.hostId = room.participants[0].userId;
      }

      await room.save();
    }

    const messages = await Message.find({ roomId }).sort({ time: 1 });

    const participantsObj = {};
    room.participants.forEach((p) => {
      participantsObj[p.userId] = {
        username: p.username,
        role: p.role
      };
    });

    socket.emit("sync_state", {
      videoId: room.videoState.videoId,
      currentTime: room.videoState.currentTime,
      playState: room.videoState.isPlaying ? "play" : "pause",
      participants: participantsObj,
      messages
    });

    io.to(roomId).emit("user_joined", {
      participants: participantsObj
    });
  });

  /* PLAY */
  socket.on("play", async ({ roomId, time }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!canControl(user)) return;

    room.videoState.isPlaying = true;
    room.videoState.currentTime = time;
    await room.save();

    io.to(roomId).emit("play", time);
  });

  /* PAUSE */
  socket.on("pause", async ({ roomId, time }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!canControl(user)) return;

    room.videoState.isPlaying = false;
    room.videoState.currentTime = time;
    await room.save();

    io.to(roomId).emit("pause", time);
  });

  /* SEEK */
  socket.on("seek", async ({ roomId, time }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!canControl(user)) return;

    room.videoState.currentTime = time;
    await room.save();

    io.to(roomId).emit("seek", time);
  });

  /* CHANGE VIDEO */
  socket.on("change_video", async ({ roomId, videoId }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!canControl(user)) return;

    room.videoState.videoId = videoId;
    room.videoState.currentTime = 0;
    room.videoState.isPlaying = true;

    await room.save();
    io.to(roomId).emit("change_video", videoId);
  });

  /* ROLE */
  socket.on("assign_role", async ({ roomId, userId, role }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!user || user.role !== "host") return;

    const target = room.participants.find(
      (p) => p.userId === userId
    );
    if (!target) return;

    target.role = role;
    await room.save();

    const participantsObj = {};
    room.participants.forEach((p) => {
      participantsObj[p.userId] = {
        username: p.username,
        role: p.role
      };
    });

    io.to(roomId).emit("role_assigned", {
      participants: participantsObj
    });
  });

  /* REMOVE */
  socket.on("remove_participant", async ({ roomId, userId }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!user || user.role !== "host") return;

    room.participants = room.participants.filter(
      (p) => p.userId !== userId
    );

    await room.save();

    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
      targetSocket.emit("kicked");
    }

    const participantsObj = {};
    room.participants.forEach((p) => {
      participantsObj[p.userId] = {
        username: p.username,
        role: p.role
      };
    });

    io.to(roomId).emit("user_joined", {
      participants: participantsObj
    });
  });

  /* CHAT */
  socket.on("send_message", async ({ roomId, username, text }) => {
    if (!text.trim()) return;

    const msg = await Message.create({
      roomId,
      username,
      text
    });

    io.to(roomId).emit("receive_message", msg);
  });

  /* DISCONNECT */
  socket.on("disconnect", async () => {
    const rooms = await Room.find();

    for (let room of rooms) {
      const idx = room.participants.findIndex(
        (p) => p.userId === socket.id
      );

      if (idx !== -1) {
        const wasHost = room.participants[idx].role === "host";
        room.participants.splice(idx, 1);

        if (wasHost && room.participants.length > 0) {
          room.participants[0].role = "host";
          room.hostId = room.participants[0].userId;
        }

        await room.save();

        const participantsObj = {};
        room.participants.forEach((p) => {
          participantsObj[p.userId] = {
            username: p.username,
            role: p.role
          };
        });

        io.to(room.roomId).emit("user_joined", {
          participants: participantsObj
        });
      }
    }
  });
});

server.listen(PORT, () =>
  console.log("Server running on", PORT)
);