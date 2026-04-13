const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();

console.log('🚀 Server starting...');

// Enhanced CORS for mobile browsers
const allowedOrigins = [
  "https://watchparty-green.vercel.app",
  "https://watchparty-git-master-richakaushik461s-projects.vercel.app",
  "https://watchparty.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000"
];

// Express CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

app.use(express.json());

// Handle preflight requests
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true
}));

// Additional CORS headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ✅ CREATE SERVER FIRST
const server = http.createServer(app);

// ✅ THEN CREATE IO WITH SERVER
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// OOP: Room class for managing room state
class Room {
  constructor(roomId, hostId, hostName) {
    this.id = roomId;
    this.hostId = hostId;
    this.participants = new Map();
    this.currentVideo = {
      videoId: 'dQw4w9WgXcQ',
      playState: false,
      currentTime: 0
    };
    this.chatMessages = [];
    this.maxChatMessages = 100;
  }

  addParticipant(socketId, username, role = 'participant') {
    this.participants.set(socketId, {
      id: socketId,
      username,
      role: socketId === this.hostId ? 'host' : role,
      joinedAt: Date.now()
    });
    return this.participants.get(socketId);
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
  }

  getParticipant(socketId) {
    return this.participants.get(socketId);
  }

  getParticipantsList() {
    return Array.from(this.participants.values());
  }

  updateVideoState(updates) {
    this.currentVideo = { ...this.currentVideo, ...updates };
  }

  setHost(newHostId) {
    const oldHost = this.participants.get(this.hostId);
    if (oldHost) {
      oldHost.role = 'participant';
    }
    this.hostId = newHostId;
    const newHost = this.participants.get(newHostId);
    if (newHost) {
      newHost.role = 'host';
    }
  }

  changeRole(socketId, newRole) {
    const participant = this.participants.get(socketId);
    if (participant && socketId !== this.hostId) {
      participant.role = newRole;
      return true;
    }
    return false;
  }

  hasPermission(socketId, action) {
    const participant = this.participants.get(socketId);
    if (!participant) return false;
    
    const role = participant.role;
    if (role === 'host') return true;
    if (role === 'moderator') {
      return ['play', 'pause', 'seek', 'change_video'].includes(action);
    }
    return false;
  }

  addChatMessage(message) {
    this.chatMessages.push(message);
    if (this.chatMessages.length > this.maxChatMessages) {
      this.chatMessages.shift();
    }
    return message;
  }

  getChatHistory() {
    return this.chatMessages;
  }
}

// Store active rooms
const rooms = new Map();

// REST API endpoints
app.post('/api/rooms', (req, res) => {
  const { username } = req.body;
  const roomId = uuidv4().substring(0, 8).toUpperCase();
  res.json({ roomId });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (room) {
    res.json({
      exists: true,
      participantCount: room.participants.size
    });
  } else {
    res.json({ exists: false });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// ✅ SOCKET.IO EVENT HANDLERS - AFTER IO IS CREATED
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  console.log('📊 Total connected clients:', io.engine.clientsCount);

  socket.on('create_room', ({ username }) => {
    console.log('📤 create_room event received from:', socket.id, 'username:', username);
    const roomId = uuidv4().substring(0, 8).toUpperCase();
    const room = new Room(roomId, socket.id, username);
    rooms.set(roomId, room);
    
    room.addParticipant(socket.id, username, 'host');
    socket.join(roomId);
    
    socket.emit('room_created', {
      roomId,
      participants: room.getParticipantsList(),
      currentVideo: room.currentVideo,
      chatHistory: room.getChatHistory()
    });
    
    console.log(`Room created: ${roomId} by ${username}`);
  });

  socket.on('join_room', ({ roomId, username }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const existingParticipant = Array.from(room.participants.values())
      .find(p => p.username === username);
    
    if (existingParticipant) {
      socket.emit('error', { message: 'Username already taken in this room' });
      return;
    }

    const participant = room.addParticipant(socket.id, username);
    socket.join(roomId);
    
    socket.emit('room_joined', {
      roomId,
      participants: room.getParticipantsList(),
      currentVideo: room.currentVideo,
      role: participant.role,
      chatHistory: room.getChatHistory()
    });
    
    socket.to(roomId).emit('user_joined', {
      userId: socket.id,
      username,
      role: participant.role,
      participants: room.getParticipantsList()
    });
    
    console.log(`${username} joined room ${roomId}`);
  });

  socket.on('play', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    if (!room.hasPermission(socket.id, 'play')) {
      socket.emit('error', { message: 'Permission denied' });
      return;
    }
    
    room.updateVideoState({ playState: true });
    io.to(roomId).emit('sync_state', room.currentVideo);
  });

  socket.on('pause', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    if (!room.hasPermission(socket.id, 'pause')) {
      socket.emit('error', { message: 'Permission denied' });
      return;
    }
    
    room.updateVideoState({ playState: false });
    io.to(roomId).emit('sync_state', room.currentVideo);
  });

  socket.on('seek', ({ roomId, time }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    if (!room.hasPermission(socket.id, 'seek')) {
      socket.emit('error', { message: 'Permission denied' });
      return;
    }
    
    room.updateVideoState({ currentTime: time });
    io.to(roomId).emit('sync_state', room.currentVideo);
  });

  socket.on('change_video', ({ roomId, videoId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    if (!room.hasPermission(socket.id, 'change_video')) {
      socket.emit('error', { message: 'Permission denied' });
      return;
    }
    
    room.updateVideoState({ videoId, currentTime: 0, playState: false });
    io.to(roomId).emit('sync_state', room.currentVideo);
  });

  socket.on('assign_role', ({ roomId, userId, role }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const host = room.getParticipant(socket.id);
    if (!host || host.role !== 'host') {
      socket.emit('error', { message: 'Only host can assign roles' });
      return;
    }
    
    const targetUser = room.getParticipant(userId);
    if (!targetUser) {
      socket.emit('error', { message: 'User not found' });
      return;
    }
    
    if (targetUser.role === 'host') {
      socket.emit('error', { message: 'Cannot change host role' });
      return;
    }
    
    room.changeRole(userId, role);
    
    const participants = room.getParticipantsList();
    
    io.to(roomId).emit('role_assigned', {
      userId,
      username: targetUser.username,
      role,
      participants: participants
    });
    
    io.to(userId).emit('your_role_updated', { role, roomId });
  });

  socket.on('remove_participant', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const host = room.getParticipant(socket.id);
    if (!host || host.role !== 'host') {
      socket.emit('error', { message: 'Only host can remove participants' });
      return;
    }
    
    const targetUser = room.getParticipant(userId);
    if (!targetUser || targetUser.role === 'host') {
      socket.emit('error', { message: 'Cannot remove this user' });
      return;
    }
    
    room.removeParticipant(userId);
    
    io.to(roomId).emit('participant_removed', {
      userId,
      participants: room.getParticipantsList()
    });
    
    io.sockets.sockets.get(userId)?.leave(roomId);
    io.to(userId).emit('kicked', { roomId });
  });

  socket.on('transfer_host', ({ roomId, newHostId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const currentHost = room.getParticipant(socket.id);
    if (!currentHost || currentHost.role !== 'host') {
      socket.emit('error', { message: 'Only host can transfer ownership' });
      return;
    }
    
    const newHost = room.getParticipant(newHostId);
    if (!newHost) {
      socket.emit('error', { message: 'User not found' });
      return;
    }
    
    room.setHost(newHostId);
    
    io.to(roomId).emit('host_transferred', {
      newHostId,
      participants: room.getParticipantsList()
    });
  });

  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const participant = room.getParticipant(socket.id);
    if (!participant) return;
    
    const chatMessage = {
      id: uuidv4(),
      userId: socket.id,
      username: participant.username,
      message: message,
      timestamp: Date.now()
    };
    
    room.addChatMessage(chatMessage);
    io.to(roomId).emit('new_message', chatMessage);
  });

  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('leave_room', ({ roomId }) => {
    handleLeaveRoom(socket, roomId);
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.participants.has(socket.id)) {
        handleLeaveRoom(socket, roomId);
      }
    });
  });

  function handleLeaveRoom(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const participant = room.getParticipant(socket.id);
    if (!participant) return;
    
    const wasHost = participant.role === 'host';
    room.removeParticipant(socket.id);
    
    socket.leave(roomId);
    socket.to(roomId).emit('user_left', {
      userId: socket.id,
      username: participant.username,
      participants: room.getParticipantsList()
    });
    
    if (room.participants.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else if (wasHost) {
      const newHost = Array.from(room.participants.values())[0];
      room.setHost(newHost.id);
      io.to(roomId).emit('host_transferred', {
        newHostId: newHost.id,
        participants: room.getParticipantsList()
      });
    }
    
    console.log(`${participant.username} left room ${roomId}`);
  }
});

// ✅ START SERVER AT THE VERY END
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📍 Access at: http://localhost:${PORT}`);
});