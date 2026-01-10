// server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid"); // to generate room codes

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// rooms = { roomCode: { mentor: ws, students: [], messages: [] } }
let rooms = {};

// Health check
app.get("/", (req, res) => {
  res.send("Chat backend is running");
});

// Generate room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Save note per room
function saveNote(room, note) {
  if (!rooms[room]) rooms[room] = { messages: [], students: [], mentor: null };
  rooms[room].messages.push(note);
  fs.writeFileSync(`notes-${room}.json`, JSON.stringify(rooms[room].messages, null, 2));
}

// Download notes PDF per room
app.get("/download-notes/:room", (req, res) => {
  const room = req.params.room;
  const notes = fs.existsSync(`notes-${room}.json`)
    ? JSON.parse(fs.readFileSync(`notes-${room}.json`))
    : [];

  if (!notes.length) return res.status(404).send("No notes available for this room.");

  const doc = new PDFDocument();
  res.setHeader("Content-Disposition", `attachment; filename=notes-${room}.pdf`);
  doc.pipe(res);
  notes.forEach(n => doc.text(`${n.name}: ${n.text}`).moveDown());
  doc.end();
});

// WebSocket logic
wss.on("connection", (ws, req) => {
  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    // Create room (mentor)
    if (msg.type === "create-room") {
      const roomCode = generateRoomCode();
      rooms[roomCode] = { mentor: ws, students: [], messages: [] };
      ws.room = roomCode;
      ws.role = "mentor";
      ws.send(JSON.stringify({ type: "room-created", code: roomCode }));
      console.log(`Room created: ${roomCode}`);
      return;
    }

    // Join room (student)
    if (msg.type === "join-room") {
      const { code, name } = msg;
      if (!rooms[code]) {
        ws.send(JSON.stringify({ type: "error", text: "Invalid room code" }));
        return;
      }
      ws.room = code;
      ws.name = name;
      ws.role = "student";
      rooms[code].students.push(ws);

      // Send chat history
      ws.send(JSON.stringify({ type: "history", data: rooms[code].messages }));
      console.log(`${name} joined room ${code}`);
      return;
    }

    // Chat message
    if (msg.type === "chat") {
      const room = ws.room;
      if (!room || !rooms[room]) return;

      const chat = {
        type: "chat",
        role: ws.role,
        name: ws.role === "student" ? ws.name : "Mentor",
        text: msg.text,
      };

      rooms[room].messages.push(chat);
      saveNote(room, chat);

      // Broadcast
      if (rooms[room].mentor) rooms[room].mentor.send(JSON.stringify(chat));
      rooms[room].students.forEach(s => s.send(JSON.stringify(chat)));
    }
  });

  ws.on("close", () => {
    if (!ws.room) return;
    const room = ws.room;
    if (!rooms[room]) return;

    if (ws.role === "mentor") {
      // Close room if mentor leaves
      rooms[room].students.forEach(s => s.send(JSON.stringify({ type: "error", text: "Mentor left, room closed" })));
      delete rooms[room];
      console.log(`Room closed: ${room}`);
    } else {
      // Remove student
      rooms[room].students = rooms[room].students.filter(s => s !== ws);
    }
  });
});

// Start server
server.listen(PORT, () => console.log("Backend running on port", PORT));
