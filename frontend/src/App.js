const { useState, useEffect, useRef } = React;

function App() {
    return (
        <div className="App font-mono">
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Crucible />} />
                </Routes>
            </BrowserRouter>
            <Toaster
                theme="dark"
                position="top-center"
                toastOptions={{
                    style: {
                        background: "hsl(var(--c-surface))",
                        border: "1px solid hsla(280,85%,60%,0.4)",
                        color: "hsl(var(--c-text))",
                        fontFamily: "JetBrains Mono, monospace",
                    },
                }}
            />
        </div>
    );
}

export default App;
const { useState, useEffect } = React;

function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');

    const sendMessage = async () => {
        if (!input.trim()) return;
        const userMsg = { role: 'user', content: input };
        setMessages([...messages, userMsg]);
        setInput('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: input })
            });
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            console.error("Error communicating with backend:", error);
        }
    };

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>AI Chat Assistant</h2>
            <div style={{ border: '1px solid #ccc', height: '300px', overflowY: 'scroll', padding: '10px', marginBottom: '10px' }}>
                {messages.map((msg, i) => (
                    <p key={i} style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                        <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
                    </p>
                ))}
            </div>
            <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                style={{ width: '70%', padding: '10px' }} 
                placeholder="Type your message..."
            />
            <button onClick={sendMessage} style={{ width: '25%', padding: '10px', marginLeft: '5%' }}>Send</button>
        </div>
    );
}

// Render the application directly into the root element
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(React.createElement(App));

