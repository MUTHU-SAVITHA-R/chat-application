// server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid"); // make sure to install: npm install uuid

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory room storage
const rooms = {}; 
// rooms = { roomCode: { mentor: ws, students: [], messages: [] } }

app.get("/", (req, res) => {
  res.send("Chat backend is running");
});

// PDF download endpoint
app.get("/download-notes/:room", (req, res) => {
  const roomCode = req.params.room;
  const room = rooms[roomCode];
  if (!room) return res.status(404).send("Room not found");

  const notes = room.messages || [];
  const doc = new PDFDocument();
  res.setHeader("Content-Disposition", `attachment; filename=notes_${roomCode}.pdf`);
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(12).text(`Chat Notes for Room: ${roomCode}`).moveDown();
  notes.forEach((n) => {
    doc.text(`${n.name} (${n.role}): ${n.text}`).moveDown();
  });

  doc.end();
});

// WebSocket connection
wss.on("connection", (ws) => {
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

    // Mentor creates room
    if (msg.type === "create-room" && msg.role === "mentor") {
      const roomCode = uuidv4().slice(0, 6); // 6-char code
      rooms[roomCode] = { mentor: ws, students: [], messages: [] };
      currentRoom = roomCode;
      currentRole = "mentor";
      ws.send(JSON.stringify({ type: "room-created", code: roomCode }));
    }

    // Student joins room
    else if (msg.type === "join-room" && msg.role === "student") {
      const { code, name } = msg;
      const room = rooms[code];
      if (!room) return ws.send(JSON.stringify({ type: "error", text: "Invalid room code" }));

      room.students.push(ws);
      room.messages.forEach((m) => ws.send(JSON.stringify({ type: "chat", ...m })));

      currentRoom = code;
      currentRole = "student";
      currentName = name;
    }

    // Chat message
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
    // Remove student
    if (currentRoom && currentRole === "student") {
      const idx = rooms[currentRoom].students.indexOf(ws);
      if (idx !== -1) rooms[currentRoom].students.splice(idx, 1);
    }

    // Delete room if mentor leaves
    if (currentRoom && currentRole === "mentor") {
      delete rooms[currentRoom];
    }
  });
});

// Start server
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
