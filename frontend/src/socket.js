import { io } from "socket.io-client";

export const socket = io("https://watchparty-backend-2w8d.onrender.com", {
  transports: ["websocket"],   // ✅ FIX: stable connection on Vercel
  autoConnect: true,           // ✅ ensure auto connect
});