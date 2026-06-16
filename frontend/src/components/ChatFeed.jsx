export default function ChatFeed({ messages, sending }) {
    return (
        <div className="space-y-3" data-testid="chat-feed-list">
            {messages.length === 0 && !sending && (
                <div className="text-center text-cmuted text-sm tracking-widest mt-12 opacity-70">
                    [ no transmissions yet. say something. ]
                </div>
            )}
            {messages.map((m) => (
                <MessageRow key={m.id} m={m} />
            ))}
            {sending && (
                <div className="w-full border-l-2 border-cmagenta bg-cmagenta/5 px-4 py-3" data-testid="typing-row">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs tracking-widest text-cmagenta font-bold">C7UC1BL3 &gt;</span>
                        <span className="text-xs tracking-widest text-cmuted">[processing...]</span>
                    </div>
                    <div className="text-sm text-ctext terminal-cursor">...</div>
                </div>
            )}
        </div>
    );
}

function MessageRow({ m }) {
    const isUser = m.role === "user";
    if (isUser) {
        return (
            <div className="w-full border-l-2 border-ccyan bg-cpurple/[0.08] px-4 py-3" data-testid="user-msg">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs tracking-widest text-ccyan font-bold">USER &gt;</span>
                </div>
                <div className="text-sm sm:text-base text-ctext whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
            </div>
        );
    }
    const glitchy = m.emotion === "GLITCHED" || (m.emotion === "ANNOYED" && (m.intensity || 0) >= 3);
    return (
        <div className={`w-full border-l-2 border-cmagenta bg-cmagenta/[0.06] px-4 py-3 ${glitchy ? "relative scanlines" : ""}`} data-testid="assistant-msg">
            <div className="flex items-center justify-between mb-1">
                <span className={`text-xs tracking-widest font-bold text-cmagenta ${glitchy ? "glitch-text" : ""}`} data-text="C7UC1BL3 >">C7UC1BL3 &gt;</span>
                {m.emotion && (
                    <span className="text-xs tracking-widest text-cmagenta/80 uppercase">
                        [{m.emotion}:{m.intensity || 1}]
                    </span>
                )}
            </div>
            <div className={`text-sm sm:text-base text-ctext whitespace-pre-wrap break-words leading-relaxed ${glitchy ? "glitch-text" : ""}`} data-text={m.content}>
                {m.content}
            </div>
        </div>
    );
}
