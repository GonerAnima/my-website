import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import EmotionBars from "@/components/EmotionBars";
import ChatFeed from "@/components/ChatFeed";
import Composer from "@/components/Composer";
import SourceModal from "@/components/SourceModal";
import ConversationsSidebar from "@/components/ConversationsSidebar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Crucible() {
    const [messages, setMessages] = useState([]);
    const [emotion, setEmotion] = useState("NORMAL");
    const [intensity, setIntensity] = useState(2);
    const [userMood, setUserMood] = useState("NEUTRAL");
    const [conversationId, setConversationId] = useState(null);
    const [sending, setSending] = useState(false);
    const [showSrc, setShowSrc] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [convRefresh, setConvRefresh] = useState(0);
    const scrollRef = useRef(null);

    const loadState = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API}/chat/state`);
            setMessages(data.messages || []);
            setEmotion(data.emotion || "NORMAL");
            setIntensity(data.intensity || 2);
            setUserMood(data.user_mood || "NEUTRAL");
            setConversationId(data.conversation_id);
        } catch (e) {
            toast.error("could not reach c7uc1bl3 // connection error");
        }
    }, []);

    useEffect(() => { loadState(); }, [loadState]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [messages, sending]);

    const sendMessage = async (text) => {
        if (!text.trim() || sending) return;
        setSending(true);
        const tempUser = {
            id: `temp-${Date.now()}`,
            role: "user",
            content: text.trim(),
            timestamp: new Date().toISOString(),
        };
        setMessages((m) => [...m, tempUser]);
        try {
            const { data } = await axios.post(`${API}/chat/message`, { text: text.trim() });
            setMessages((m) => {
                const without = m.filter((x) => x.id !== tempUser.id);
                return [...without, data.user_message, data.assistant_message];
            });
            setEmotion(data.emotion);
            setIntensity(data.intensity);
            setUserMood(data.user_mood);
            setConversationId(data.conversation_id);
            setConvRefresh((n) => n + 1);
        } catch (e) {
            setMessages((m) => m.filter((x) => x.id !== tempUser.id));
            const msg = e?.response?.data?.detail || "transmission failed";
            toast.error(String(msg));
        } finally {
            setSending(false);
        }
    };

    const newConversation = async () => {
        try {
            const { data } = await axios.post(`${API}/chat/new`);
            setMessages([]);
            setEmotion(data.emotion);
            setIntensity(data.intensity);
            setUserMood(data.user_mood);
            setConversationId(data.conversation_id);
            setConvRefresh((n) => n + 1);
            toast("// new conversation initialized. memory intact.");
        } catch (e) {
            toast.error("could not start new conversation");
        }
    };

    const switchConversation = async (id) => {
        try {
            const { data } = await axios.post(`${API}/conversations/switch`, { conversation_id: id });
            setMessages(data.messages || []);
            setEmotion(data.emotion);
            setIntensity(data.intensity);
            setUserMood(data.user_mood);
            setConversationId(data.conversation_id);
            setShowSidebar(false);
        } catch (e) {
            toast.error("could not switch conversation");
        }
    };

    const isGlitching = emotion === "GLITCHED" || (emotion === "ANNOYED" && intensity >= 3) || (emotion === "FRUSTRATED" && intensity >= 4);

    return (
        <div className="prismatic-bg min-h-screen w-full flex flex-col text-ctext relative overflow-hidden" data-testid="crucible-app">
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-1.5 border border-cpurple/40 bg-csurface/60 backdrop-blur-sm" data-testid="id-badge">
                <span className={`inline-block w-2 h-2 rounded-full ${isGlitching ? "bg-cerror" : "bg-cpurple"} ${isGlitching ? "animate-pulse" : ""}`} />
                <span className={`text-xs tracking-[0.25em] font-bold ${isGlitching ? "glitch-text" : ""}`} data-text="C7UC1BL3">C7UC1BL3</span>
            </div>

            <div className="flex-none min-h-[260px] sm:min-h-[300px] relative flex items-center justify-center pt-12 pb-2" data-testid="avatar-container">
                <Avatar glitching={isGlitching} emotion={emotion} />
            </div>

            <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 my-4 sm:my-6">
                <EmotionBars emotion={emotion} intensity={intensity} userMood={userMood} />
            </div>

            <div ref={scrollRef} className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pb-44 sm:pb-40 overflow-y-auto" data-testid="chat-feed">
                <ChatFeed messages={messages} sending={sending} />
            </div>

            <Composer
                onSend={sendMessage}
                onNew={newConversation}
                onOpenSrc={() => setShowSrc(true)}
                onOpenSidebar={() => setShowSidebar(true)}
                sending={sending}
            />

            {showSrc && <SourceModal onClose={() => setShowSrc(false)} />}
            <ConversationsSidebar
                open={showSidebar}
                onClose={() => setShowSidebar(false)}
                onSwitch={switchConversation}
                onNew={() => { setShowSidebar(false); newConversation(); }}
                currentId={conversationId}
                refreshKey={convRefresh}
            />
        </div>
    );
}
