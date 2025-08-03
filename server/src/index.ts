import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import { monitor } from '@colyseus/monitor';
import { GameRoom } from './rooms/GameRoom';

const port = Number(process.env.PORT || 2567);
const app = express();

// Create WebSocket server
const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
    pingInterval: 3000, // Send ping every 3 seconds
    pingMaxRetries: 3,  // Allow 3 retries before dropping connection
  }),
});

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Register GameRoom as "game"
gameServer.define("game", GameRoom);

// Register Colyseus Monitor (development only)
app.use("/colyseus", monitor());

gameServer.listen(port).then(() => {
  console.log(`🎮 Game Server running on ws://localhost:${port}`);
});