import { useState } from "react";
import { ArrowUp, RotateCcw, Code2, Menu } from "lucide-react";

export default function Composer({ onSend, onNew, onOpenSrc, onOpenSidebar, sending }) {
    const [text, setText] = useState("");

    const submit = (e) => {
        e?.preventDefault?.();
        if (!text.trim() || sending) return;
        onSend(text);
        setText("");
    };

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-30 bg-csurface/85 backdrop-blur-xl border-t border-cpurple/30"
            data-testid="composer"
        >
            <div className="p-3 sm:p-4">
                <form onSubmit={submit} className="w-full max-w-4xl mx-auto flex gap-2 items-stretch">
                    <button
                        type="button"
                        onClick={onOpenSidebar}
                        title="conversation history"
                        className="h-12 w-12 sm:h-14 sm:w-14 flex-none border border-cpurple/40 bg-black/30 hover:bg-cpurple/20 transition-colors flex items-center justify-center text-ctext"
                        data-testid="sidebar-button"
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onNew}
                        title="new conversation (memory retained)"
                        className="hidden sm:flex h-12 w-12 sm:h-14 sm:w-14 flex-none border border-cpurple/40 bg-black/30 hover:bg-cpurple/20 transition-colors items-center justify-center text-ctext"
                        data-testid="new-conversation-button"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onOpenSrc}
                        title="view source code"
                        className="h-12 w-12 sm:h-14 sm:w-14 flex-none border border-cpurple/40 bg-black/30 hover:bg-cpurple/20 transition-colors flex items-center justify-center text-ctext"
                        data-testid="src-button"
                    >
                        <Code2 className="w-4 h-4" />
                    </button>
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="transmit message..."
                        disabled={sending}
                        className="flex-1 h-12 sm:h-14 bg-black/40 border border-cpurple/30 focus:border-cpurple focus:outline-none focus:ring-1 focus:ring-cpurple text-ctext placeholder:text-cmuted px-4 font-mono text-sm sm:text-base min-w-0"
                        data-testid="message-input"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={sending || !text.trim()}
                        className="h-12 sm:h-14 px-4 sm:px-6 flex-none border border-cpurple bg-cpurple/30 hover:bg-cpurple hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all text-ctext flex items-center justify-center"
                        data-testid="send-button"
                    >
                        <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </form>
            </div>
            {/* Safe-area / home-indicator black bar for mobile */}
            <div
                className="bg-black w-full"
                style={{ height: "max(env(safe-area-inset-bottom), 18px)" }}
                data-testid="safe-area-bar"
            />
        </div>
    );
}