import { io } from "socket.io-client";

export const socket = io("https://watchparty-backend-2w8d.onrender.com", {
  transports: ["websocket"], // ✅ FIX 400 error
  autoConnect: false,
});