import { useEffect, useState } from "react";
import axios from "axios";
import { X, Copy, Download, FileCode, Wand2, Check } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SourceModal({ onClose }) {
    const [files, setFiles] = useState([]);
    const [active, setActive] = useState(null);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);

    // self-modification state
    const [modOpen, setModOpen] = useState(false);
    const [instruction, setInstruction] = useState("");
    const [proposing, setProposing] = useState(false);
    const [proposal, setProposal] = useState(null); // {reasoning, new_content}
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get(`${API}/source/tree`);
                setFiles(data.files || []);
                if (data.files?.length) pick(data.files[0]);
            } catch (e) {
                toast.error("could not fetch source tree");
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pick = async (f) => {
        setActive(f);
        setLoading(true);
        setProposal(null);
        setModOpen(false);
        try {
            const { data } = await axios.get(`${API}/source/file`, { params: { path: f.path } });
            setContent(data.content || "");
        } catch (e) {
            setContent("// could not load file");
        } finally {
            setLoading(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            toast.success("// copied to clipboard");
        } catch {
            toast.error("clipboard unavailable");
        }
    };

    const download = () => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = active?.path?.replace(/\//g, "_") || "crucible.txt";
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    };

    const propose = async () => {
        if (!instruction.trim() || !active) return;
        setProposing(true);
        setProposal(null);
        try {
            const { data } = await axios.post(`${API}/code/propose`, {
                path: active.path,
                instruction: instruction.trim(),
            });
            setProposal(data);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "proposal failed");
        } finally {
            setProposing(false);
        }
    };

    const apply = async () => {
        if (!proposal || !active) return;
        setApplying(true);
        try {
            await axios.post(`${API}/code/apply`, {
                path: active.path,
                content: proposal.new_content,
            });
            setContent(proposal.new_content);
            setProposal(null);
            setInstruction("");
            setModOpen(false);
            toast.success("// patch applied. hot reload should kick in.");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "apply failed");
        } finally {
            setApplying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4" data-testid="code-viewer-modal" onClick={onClose}>
            <div
                className="w-full max-w-6xl h-[92vh] sm:h-[85vh] bg-csurface border border-cpurple/40 shadow-[0_0_60px_rgba(176,80,255,0.25)] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-cpurple/30 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-cpurple animate-pulse" />
                        <span className="text-xs sm:text-sm tracking-[0.25em] font-bold text-cpurple uppercase">// c7uc1bl3 source dump</span>
                    </div>
                    <button onClick={onClose} className="text-ctext hover:text-cpurple transition-colors" data-testid="close-source-modal">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <div className="w-[35%] md:w-[26%] border-r border-cpurple/20 bg-black/30 overflow-y-auto" data-testid="source-tree">
                        <div className="px-3 py-2 text-[10px] tracking-widest text-cmuted uppercase">files</div>
                        {files.map((f) => (
                            <button
                                key={f.path}
                                onClick={() => pick(f)}
                                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-l-2 transition-colors ${
                                    active?.path === f.path
                                        ? "border-cpurple bg-cpurple/15 text-ctext"
                                        : "border-transparent text-cmuted hover:bg-cpurple/5 hover:text-ctext"
                                }`}
                                data-testid={`source-file-${f.path.replace(/[^a-z0-9]/gi, "-")}`}
                            >
                                <FileCode className="w-3 h-3 flex-none" />
                                <span className="truncate">{f.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: "#0a0510" }}>
                        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-cpurple/20 gap-2 flex-wrap">
                            <span className="text-[10px] sm:text-xs text-cmuted truncate font-mono">{active?.path || "—"}</span>
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={() => setModOpen((v) => !v)} className="px-2 py-1 text-xs border border-cmagenta/50 text-cmagenta hover:bg-cmagenta/20 flex items-center gap-1" data-testid="self-mod-toggle">
                                    <Wand2 className="w-3 h-3" /> ask crucible to edit
                                </button>
                                <button onClick={copy} className="px-2 py-1 text-xs border border-cpurple/40 hover:bg-cpurple/20 flex items-center gap-1 text-ctext" data-testid="code-copy-button">
                                    <Copy className="w-3 h-3" /> copy
                                </button>
                                <button onClick={download} className="px-2 py-1 text-xs border border-cpurple/40 hover:bg-cpurple/20 flex items-center gap-1 text-ctext" data-testid="code-download-button">
                                    <Download className="w-3 h-3" /> dl
                                </button>
                            </div>
                        </div>

                        {modOpen && (
                            <div className="border-b border-cmagenta/30 bg-cmagenta/5 p-3 space-y-2" data-testid="self-mod-panel">
                                <div className="text-[10px] tracking-widest uppercase text-cmagenta">// self-modification prompt</div>
                                <textarea
                                    value={instruction}
                                    onChange={(e) => setInstruction(e.target.value)}
                                    placeholder="e.g. add a tiny tooltip on the send button..."
                                    className="w-full bg-black/40 border border-cmagenta/40 focus:border-cmagenta focus:outline-none text-ctext placeholder:text-cmuted p-2 text-xs font-mono h-20 resize-none"
                                    data-testid="self-mod-instruction"
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={propose}
                                        disabled={proposing || !instruction.trim()}
                                        className="px-3 py-1.5 text-xs border border-cmagenta bg-cmagenta/20 hover:bg-cmagenta/40 text-ctext disabled:opacity-40 flex items-center gap-1"
                                        data-testid="self-mod-propose"
                                    >
                                        <Wand2 className="w-3 h-3" /> {proposing ? "thinking..." : "propose patch"}
                                    </button>
                                </div>
                                {proposal && (
                                    <div className="border-t border-cmagenta/30 pt-2 space-y-2">
                                        <div className="text-[10px] tracking-widest uppercase text-cmagenta">// crucible says</div>
                                        <div className="text-xs text-ctext italic">{proposal.reasoning}</div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setProposal(null)}
                                                className="px-3 py-1.5 text-xs border border-cmuted/40 text-cmuted hover:bg-white/5"
                                                data-testid="self-mod-discard"
                                            >
                                                discard
                                            </button>
                                            <button
                                                onClick={apply}
                                                disabled={applying}
                                                className="px-3 py-1.5 text-xs border border-cpurple bg-cpurple/30 hover:bg-cpurple/60 text-ctext flex items-center gap-1"
                                                data-testid="self-mod-apply"
                                            >
                                                <Check className="w-3 h-3" /> {applying ? "applying..." : "apply patch"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <pre className="flex-1 overflow-auto p-3 sm:p-4 text-[11px] sm:text-xs leading-relaxed text-ctext whitespace-pre font-mono" data-testid="code-content">
                            {loading ? "// loading..." : (proposal ? proposal.new_content : content)}
                        </pre>
                        {proposal && (
                            <div className="px-3 py-1.5 border-t border-cmagenta/40 bg-cmagenta/10 text-[10px] tracking-widest uppercase text-cmagenta">
                                // previewing proposed patch — apply or discard above
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
