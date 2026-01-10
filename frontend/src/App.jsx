import { useRef, useState } from "react";
import "./style.css";

const BACKEND_WS = "wss://chat-application-x3vg.onrender.com";

export default function App() {
  const socketRef = useRef(null);
  const [stage, setStage] = useState("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [role, setRole] = useState("");

  const connect = () => {
    const socket = new WebSocket(BACKEND_WS);
    socketRef.current = socket;

    socket.onopen = () => {
      if (role === "mentor") socket.send(JSON.stringify({ type: "create-room" }));
      else socket.send(JSON.stringify({ type: "join-room", code, name }));
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "room-created") {
        setRoom(data.code);
        setStage("chat");
      }

      if (data.type === "history") setMessages(data.data);
      if (data.type === "chat") setMessages((m) => [...m, data]);
      if (data.type === "error") alert(data.text);
    };
  };

  const send = () => {
    socketRef.current.send(JSON.stringify({ type: "chat", text: message }));
    setMessage("");
  };

  if (stage === "home") {
    return (
      <div className="center">
        <h2>Virtual Classroom</h2>
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Room Code (students)" value={code} onChange={(e) => setCode(e.target.value)} />
        <button onClick={() => { setRole("mentor"); connect(); }}>Create Class</button>
        <button onClick={() => { setRole("student"); connect(); }}>Join Class</button>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">Room: {room}</div>

      <div className="chatBox">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <b>{m.name}</b>
            <p>{m.text}</p>
          </div>
        ))}
      </div>

      <div className="inputBox">
        <input value={message} onChange={(e) => setMessage(e.target.value)} />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
