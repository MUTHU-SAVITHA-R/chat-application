import { useRef, useState } from "react";
import "./style.css";

const BACKEND_WS = "wss://chat-application-x3vg.onrender.com";
const BACKEND_HTTP = "https://chat-application-x3vg.onrender.com";

export default function App() {
  const socketRef = useRef(null);
  const [stage, setStage] = useState("home");
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState(""); // Student input
  const [room, setRoom] = useState(""); // Actual room code from backend
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const connect = (selectedRole) => {
    if (!name.trim()) return alert("Enter your name");
    if (selectedRole === "student" && !roomInput.trim()) return alert("Enter room code");

    setRole(selectedRole);

    const socket = new WebSocket(BACKEND_WS);
    socketRef.current = socket;

    socket.onopen = () => {
      if (selectedRole === "mentor") {
        // Mentor creates a room
        socket.send(JSON.stringify({ type: "create-room", role: "mentor" }));
      } else {
        // Student joins room
        socket.send(JSON.stringify({
          type: "join-room",
          role: "student",
          code: roomInput, // pass the input code exactly
          name: name
        }));
      }
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("Received:", data);

      if (data.type === "room-created") {
        setRoom(data.code);
        setStage("chat");
      }

      if (data.type === "chat") setMessages(prev => [...prev, data]);

      if (data.type === "error") alert(data.text);
    };

    socket.onerror = () => alert("WebSocket connection failed");
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socketRef.current.send(JSON.stringify({ type: "chat", text: message }));
    setMessage("");
  };

  const downloadNotes = () => {
    if (!room) return alert("Room not available");
    window.open(`${BACKEND_HTTP}/download-notes/${room}`);
  };

  if (stage === "home") {
    return (
      <div className="center">
        <h2>Virtual Classroom</h2>
        <input
          placeholder="Your Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          placeholder="Room Code (for students)"
          value={roomInput}
          onChange={e => setRoomInput(e.target.value)}
        />
        <div className="btn-group">
          <button onClick={() => connect("mentor")}>Create Class</button>
          <button onClick={() => connect("student")}>Join Class</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        {role === "mentor" ? "Mentor Classroom" : "Student Classroom"} | Room: {room}
      </div>

      <button className="downloadBtn" onClick={downloadNotes}>📄 Download Notes</button>

      <div className="chatBox">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`msg ${m.role}`}
            style={{
              alignSelf: m.role === role ? "flex-end" : "flex-start",
              background: m.role === "mentor" ? "#d1e7ff" : "#e2ffe2"
            }}
          >
            <b>{m.name}</b>
            <p>{m.text}</p>
          </div>
        ))}
      </div>

      <div className="inputBox">
        <input
          placeholder="Type message..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
