const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
const http = require("http");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* ===========================
   Render health check
=========================== */
app.get("/", (req, res) => {
  res.send("Chat backend running");
});

/* ===========================
   Rooms
=========================== */
const rooms = {};  
// rooms = { CODE : { mentor, students:[], messages:[], expiry } }

/* ===========================
   Generate Room Code
=========================== */
function generateCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

/* ===========================
   WebSocket
=========================== */
wss.on("connection", (ws) => {

  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    // Mentor creates room
    if (msg.type === "create-room") {
      const code = generateCode();

      rooms[code] = {
        mentor: ws,
        students: [],
        messages: [],
        expiry: Date.now() + 30 * 60 * 1000 // 30 minutes
      };

      ws.room = code;
      ws.role = "mentor";

      ws.send(JSON.stringify({ type: "room-created", code }));

      return;
    }

    // Student joins
    if (msg.type === "join-room") {
      const room = rooms[msg.code];

      if (!room) {
        ws.send(JSON.stringify({ type: "error", text: "Invalid room code" }));
        return;
      }

      if (Date.now() > room.expiry) {
        delete rooms[msg.code];
        ws.send(JSON.stringify({ type: "error", text: "Class expired" }));
        return;
      }

      ws.room = msg.code;
      ws.role = "student";
      ws.name = msg.name;

      room.students.push(ws);
      ws.send(JSON.stringify({ type: "joined", code: msg.code }));
      ws.send(JSON.stringify({ type: "history", data: room.messages }));

      return;
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
      room.students.forEach(s => s.send(JSON.stringify(chat)));
    }
  });
});

/* ===========================
   Start Server
=========================== */
server.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
