import { io, type Socket } from "socket.io-client";

// Single shared socket.io connection. Same-origin so it rides the Vite proxy.
export const socket: Socket = io({ autoConnect: false });
