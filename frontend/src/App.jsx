import { useRef, useState } from "react";
import "./style.css";

const BACKEND_WS = "wss://chat-application-x3vg.onrender.com";
const BACKEND_HTTP = "https://chat-application-x3vg.onrender.com";

export default function App() {
  const socketRef = useRef(null);
  const [stage, setStage] = useState("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [role, setRole] = useState("");

  const connect = (selectedRole) => {
    setRole(selectedRole);
    const socket = new WebSocket(BACKEND_WS);
    socketRef.current = socket;

    socket.onopen = () => {
      if (selectedRole === "mentor") socket.send(JSON.stringify({ type: "create-room" }));
      else socket.send(JSON.stringify({ type: "join-room", code, name }));
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "room-created") {
        setRoom(data.code);
        setStage("chat");
      }

      if (data.type === "history") setMessages(data.data);
      if (data.type === "chat") setMessages(prev => [...prev, data]);
      if (data.type === "error") alert(data.text);
    };
  };

  const send = () => {
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
        <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Room Code (students)" value={code} onChange={e => setCode(e.target.value)} />
        <button onClick={() => connect("mentor")}>Create Class</button>
        <button onClick={() => connect("student")}>Join Class</button>
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
          <div key={i} className={`msg ${m.role}`} style={{
            alignSelf: m.role === role ? "flex-end" : "flex-start",
            background: m.role === "mentor" ? "#d1e7ff" : "#e2ffe2"
          }}>
            <b>{m.name}</b>
            <p>{m.text}</p>
          </div>
        ))}
      </div>

      <div className="inputBox">
        <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Type message..." />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
