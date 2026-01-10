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

let mentor = null;
let students = [];
let messages = [];

/* ===============================
   Render health check route
   THIS IS REQUIRED
================================*/
app.get("/", (req, res) => {
  res.send("Chat backend is running");
});

/* ===============================
   Notes file functions
================================*/
function clearNotes() {
  fs.writeFileSync("notes.json", JSON.stringify([], null, 2));
}

function saveNote(note) {
  const notes = fs.existsSync("notes.json")
    ? JSON.parse(fs.readFileSync("notes.json"))
    : [];
  notes.push(note);
  fs.writeFileSync("notes.json", JSON.stringify(notes, null, 2));
}

/* ===============================
   WebSocket logic
================================*/
wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    // Mentor joins
    if (msg.type === "join" && msg.role === "mentor") {
      mentor = ws;
      clearNotes();
      students.forEach((s) =>
        s.send(JSON.stringify({ type: "history", data: messages }))
      );
    }

    // Student joins
    if (msg.type === "join" && msg.role === "student") {
      ws.name = msg.name;
      students.push(ws);
      ws.send(JSON.stringify({ type: "history", data: messages }));
    }

    // Chat message
    if (msg.type === "chat") {
      const chat = {
        type: "chat",
        role: msg.role,
        name: msg.name,
        text: msg.text,
      };

      messages.push(chat);
      saveNote(chat);

      if (mentor) mentor.send(JSON.stringify(chat));
      students.forEach((s) => s.send(JSON.stringify(chat)));
    }
  });
});

/* ===============================
   Download PDF
================================*/
app.get("/download-notes", (req, res) => {
  const notes = fs.existsSync("notes.json")
    ? JSON.parse(fs.readFileSync("notes.json"))
    : [];

  const doc = new PDFDocument();
  res.setHeader("Content-Disposition", "attachment; filename=notes.pdf");

  doc.pipe(res);
  notes.forEach((n) => {
    doc.text(`${n.name}: ${n.text}`).moveDown();
  });
  doc.end();
});

/* ===============================
   Start server
================================*/
server.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
