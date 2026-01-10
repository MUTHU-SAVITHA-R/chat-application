const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid"); // for unique room codes

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory storage for rooms
const rooms = {}; 
// rooms = {
//   roomCode1: { mentor: ws, students: [ws1, ws2], messages: [] }
// }

app.get("/", (req, res) => {
  res.send("Chat backend is running");
});

/* ==============================
   Download notes PDF for a room
============================== */
app.get("/download-notes/:room", (req, res) => {
  const { room } = req.params;
  if (!rooms[room]) return res.status(404).send("Room not found");

  const notes = rooms[room].messages || [];
  const doc = new PDFDocument();
  res.setHeader("Content-Disposition", `attachment; filename=notes_${room}.pdf`);
  doc.pipe(res);

  notes.forEach((n) => doc.text(`${n.name} (${n.role}): ${n.text}`).moveDown());
  doc.end();
});

/* ==============================
   WebSocket connection
============================== */
wss.on("connection", (ws, req) => {
  let currentRoom = null;
  let currentRole = null;
  let currentName = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    // CREATE ROOM (mentor)
    if (msg.type === "create-room" && msg.role === "mentor") {
      const roomCode = uuidv4().slice(0, 6); // short room code
      rooms[roomCode] = { mentor: ws, students: [], messages: [] };
      currentRoom = roomCode;
      currentRole = "mentor";
      ws.send(JSON.stringify({ type: "room-created", code: roomCode }));
    }

    // JOIN ROOM (student)
    else if (msg.type === "join-room" && msg.role === "student") {
      const { code, name } = msg;
      if (!rooms[code]) return ws.send(JSON.stringify({ type: "error", text: "Invalid room code" }));

      rooms[code].students.push(ws);
      rooms[code].messages.forEach((m) => ws.send(JSON.stringify({ type: "chat", ...m })));

      currentRoom = code;
      currentRole = "student";
      currentName = name;
    }

    // CHAT MESSAGE
    else if (msg.type === "chat" && currentRoom) {
      const chat = {
        name: currentRole === "student" ? currentName : "Mentor",
        role: currentRole,
        text: msg.text,
      };

      rooms[currentRoom].messages.push(chat);

      // Broadcast to mentor
      if (rooms[currentRoom].mentor && rooms[currentRoom].mentor.readyState === WebSocket.OPEN) {
        rooms[currentRoom].mentor.send(JSON.stringify({ type: "chat", ...chat }));
      }

      // Broadcast to students
      rooms[currentRoom].students.forEach((s) => {
        if (s.readyState === WebSocket.OPEN) s.send(JSON.stringify({ type: "chat", ...chat }));
      });
    }
  });

  ws.on("close", () => {
    // remove student from room
    if (currentRoom && currentRole === "student") {
      const index = rooms[currentRoom].students.indexOf(ws);
      if (index !== -1) rooms[currentRoom].students.splice(index, 1);
    }

    // if mentor leaves, delete room
    if (currentRoom && currentRole === "mentor") {
      delete rooms[currentRoom];
    }
  });
});

/* ==============================
   Start server
============================== */
server.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
