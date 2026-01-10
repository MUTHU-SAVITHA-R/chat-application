const WebSocket = require("ws");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const express = require("express");
const cors = require("cors");
const http = require("http");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* ============================
   Rooms
============================ */
const rooms = {}; // roomCode → { mentor, students[], messages[], expires }

/* ============================
   Health check
============================ */
app.get("/", (req, res) => {
  res.send("Chat backend running");
});

/* ============================
   Generate Room Code
============================ */
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* ============================
   WebSocket
============================ */
wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    // Create room (mentor)
    if (msg.type === "create-room") {
      const code = generateCode();

      rooms[code] = {
        mentor: ws,
        students: [],
        messages: [],
        expires: Date.now() + 30 * 60 * 1000 // 30 min
      };

      ws.room = code;
      ws.role = "mentor";

      ws.send(JSON.stringify({ type: "room-created", code }));
      return;
    }

    // Join room (student)
    if (msg.type === "join-room") {
      const room = rooms[msg.code];

      if (!room) {
        ws.send(JSON.stringify({ type: "error", text: "Invalid room code" }));
        return;
      }

      if (Date.now() > room.expires) {
        delete rooms[msg.code];
        ws.send(JSON.stringify({ type: "error", text: "Class expired" }));
        return;
      }

      ws.name = msg.name;
      ws.room = msg.code;
      ws.role = "student";

      room.students.push(ws);
      ws.send(JSON.stringify({ type: "history", data: room.messages }));
    }

    // Chat
    if (msg.type === "chat") {
      const room = rooms[ws.room];
      if (!room) return;

      const chat = {
        type: "chat",
        name: ws.role === "mentor" ? "Mentor" : ws.name,
        role: ws.role,
        text: msg.text
      };

      room.messages.push(chat);

      if (room.mentor) room.mentor.send(JSON.stringify(chat));
      room.students.forEach((s) => s.send(JSON.stringify(chat)));
    }
  });
});

/* ============================
   Start server
============================ */
server.listen(PORT, () => {
  console.log("Backend running on", PORT);
});
