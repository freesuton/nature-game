import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { monitor } from '@colyseus/monitor';

import { SimpleRoom } from './rooms/SimpleRoom';

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

// Register SimpleRoom as "simple"
gameServer.define("simple", SimpleRoom);

// Register Colyseus Monitor (development only)
app.use("/colyseus", monitor());

// Serve static client files
const clientDistPath = path.join(__dirname, '../../client/dist');
console.log(`Looking for client files at: ${clientDistPath}`);

// Always serve built client files if they exist
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for WebSocket upgrades or API routes
  if (req.url.startsWith('/colyseus') || req.headers.upgrade === 'websocket') {
    return;
  }
  
  // Check if index.html exists, if not show development info
  const indexPath = path.join(clientDistPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <h1>🎮 Nature Game Server</h1>
      <p><strong>Server Status:</strong> Running on port ${port}</p>
      <p><strong>WebSocket:</strong> ws://localhost:${port}</p>
      <p><strong>Monitor:</strong> <a href="/colyseus">Colyseus Monitor</a></p>
      <hr>
      <h3>To serve the game client:</h3>
      <ol>
        <li>Run: <code>npm run dev:fullstack</code></li>
        <li>Or build client first: <code>npm run build:client</code></li>
      </ol>
      <p><em>Client files will be served from this same URL once built.</em></p>
      <p><strong>Looking for files at:</strong> ${clientDistPath}</p>
    `);
  }
});

gameServer.listen(port).then(() => {
  console.log(`🎮 Game Server running on http://localhost:${port}`);
  console.log(`🌐 WebSocket available at ws://localhost:${port}`);
  console.log(`📊 Monitor available at http://localhost:${port}/colyseus`);
});