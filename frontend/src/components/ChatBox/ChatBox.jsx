import './ChatBox.css';

function ChatBox() {
  return (
    <div className="chat-box">
      <p><span className="green">NanoByte:</span> nice move!</p>
      <p><span className="purple">SkyHunter:</span> gl hf</p>
      <p><span className="red">DarkNova:</span> 😄</p>

      <input placeholder="Press ENTER to chat..." />
    </div>
  );
}

export default ChatBox;