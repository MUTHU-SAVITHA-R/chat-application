const WebSocket = require("ws");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { v4: uuidv4 } = require("uuid"); // for room codes

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* ==========================
   Rooms: mentor, students, messages
========================== */
let rooms = {};

/* ==========================
   Health check
========================== */
app.get("/", (req, res) => {
  res.send("Chat backend is running");
});

/* ==========================
   Download notes for a room
========================== */
app.get("/download-notes/:room", (req, res) => {
  const roomCode = req.params.room;
  const room = rooms[roomCode];

  if (!room || !room.messages.length) {
    return res.status(404).send("No notes available for this room");
  }

  const doc = new PDFDocument();
  res.setHeader("Content-Disposition", "attachment; filename=notes.pdf");
  doc.pipe(res);

  room.messages.forEach((m) => {
    doc.text(`${m.name}: ${m.text}`).moveDown();
  });

  doc.end();
});

/* ==========================
   WebSocket logic
========================== */
wss.on("connection", (ws, req) => {
  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    // Mentor creates room
    if (msg.type === "create-room") {
      const roomCode = uuidv4().slice(0, 6).toUpperCase(); // short code
      rooms[roomCode] = { mentor: ws, students: [], messages: [] };
      ws.room = roomCode;
      ws.role = "mentor";
      ws.send(JSON.stringify({ type: "room-created", code: roomCode }));
    }

    // Student joins room
    if (msg.type === "join-room") {
      const { code, name } = msg;
      const room = rooms[code];
      if (!room) return ws.send(JSON.stringify({ type: "error", text: "Invalid room code" }));

      ws.name = name;
      ws.role = "student";
      ws.room = code;
      room.students.push(ws);
      ws.send(JSON.stringify({ type: "history", data: room.messages }));
    }

    // Chat message
    if (msg.type === "chat") {
      const room = rooms[ws.room];
      if (!room) return;

      const chat = { type: "chat", role: ws.role, name: ws.name || "Mentor", text: msg.text };
      room.messages.push(chat);

      // Send to all in room
      if (room.mentor) room.mentor.send(JSON.stringify(chat));
      room.students.forEach((s) => s.send(JSON.stringify(chat)));
    }
  });

  ws.on("close", () => {
    // Remove disconnected student
    if (ws.role === "student" && ws.room && rooms[ws.room]) {
      rooms[ws.room].students = rooms[ws.room].students.filter((s) => s !== ws);
    }
    // If mentor disconnects, clear room
    if (ws.role === "mentor" && ws.room && rooms[ws.room]) {
      rooms[ws.room].students.forEach((s) =>
        s.send(JSON.stringify({ type: "error", text: "Mentor disconnected, room closed" }))
      );
      delete rooms[ws.room];
    }
  });
});

/* ==========================
   Start server
========================== */
server.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
