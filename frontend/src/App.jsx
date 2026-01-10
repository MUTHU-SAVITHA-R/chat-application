import { useRef, useState } from "react";
import "./style.css";

const BACKEND_WS = "wss://chat-application-x3vg.onrender.com";
const BACKEND_HTTP = "https://chat-application-x3vg.onrender.com";

export default function App() {
  const socketRef = useRef(null);
  const [role, setRole] = useState("");
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [name, setName] = useState("");

  const downloadNotes = () => {
    window.open(`${BACKEND_HTTP}/download-notes`);
  };

  const connect = (selectedRole) => {
    if (selectedRole === "student" && !name.trim()) {
      alert("Please enter your name");
      return;
    }

    setRole(selectedRole);

    const socket = new WebSocket(BACKEND_WS);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "join",
          role: selectedRole,
          name,
        })
      );
      setConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "history") setMessages(data.data);
      else if (data.type === "chat") setMessages((prev) => [...prev, data]);
      else alert(data.text);
    };

    socket.onerror = () => alert("Connection error");
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socketRef.current.send(
      JSON.stringify({
        type: "chat",
        role,
        name: role === "student" ? name : "Mentor",
        text: message,
      })
    );
    setMessage("");
  };

  if (!connected) {
    return (
      <div style={styles.center}>
        <h2>Virtual Classroom</h2>
        <input
          style={styles.nameInput}
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button style={styles.roleBtn} onClick={() => connect("mentor")}>Mentor</button>
        <button style={styles.roleBtn} onClick={() => connect("student")}>Student</button>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.header}>{role === "mentor" ? "Mentor" : "Student"}</div>
      <button style={styles.downloadBtn} onClick={downloadNotes}>Download Notes</button>
      <div style={styles.chatBox}>
        {messages.map((m, i) => (
          <div key={i} style={styles.message}>
            <b>{m.name}</b>: {m.text}
          </div>
        ))}
      </div>
      <div style={styles.inputBox}>
        <input value={message} onChange={(e) => setMessage(e.target.value)} />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

const styles = {
  app: { height: "100vh", display: "flex", flexDirection: "column" },
  header: { padding: 10, background: "#128c7e", color: "white" },
  chatBox: { flex: 1, overflowY: "auto", padding: 10 },
  inputBox: { display: "flex" },
  center: { height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" },
  roleBtn: { margin: 5, padding: 10 },
  nameInput: { padding: 10 },
  message: { padding: 5 }
};
