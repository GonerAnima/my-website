import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Crucible from "@/components/Crucible";

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
