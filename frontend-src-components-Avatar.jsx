import { useMemo } from "react";

const AVATAR_URL = "https://customer-assets.emergentagent.com/job_b9301c64-d653-45a8-8beb-103bde061242/artifacts/3ykglomh_C7uc1bl3.png";

export default function Avatar({ glitching = false, emotion = "NORMAL" }) {
    const haloIntensity = useMemo(() => {
        if (glitching) return "opacity-90";
        if (emotion === "AMUSED" || emotion === "HAPPY" || emotion === "PLAYFUL") return "opacity-80";
        return "opacity-60";
    }, [glitching, emotion]);

    return (
        <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center" data-testid="avatar-frame">
            {/* Prismatic halo */}
            <div className={`absolute inset-[-40%] prismatic-halo rounded-full blur-2xl animate-halo pointer-events-none ${haloIntensity}`} />
            {/* Soft inner ring */}
            <div className="absolute inset-[-8%] rounded-full border border-cpurple/20" />
            <div className="absolute inset-[-2%] rounded-full border border-cpurple/10" />

            {/* Avatar image - with optional glitch wrapper */}
            <div className={`relative w-full h-full flex items-center justify-center animate-float ${glitching ? "glitching" : ""}`}>
                {glitching && (
                    <>
                        <img
                            src={AVATAR_URL}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-contain"
                            style={{ filter: "drop-shadow(3px 0 0 hsl(320 80% 55%))", opacity: 0.55, mixBlendMode: "screen" }}
                        />
                        <img
                            src={AVATAR_URL}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-contain"
                            style={{ filter: "drop-shadow(-3px 0 0 hsl(180 80% 50%))", opacity: 0.55, mixBlendMode: "screen" }}
                        />
                    </>
                )}
                <img
                    src={AVATAR_URL}
                    alt="C7UC1BL3"
                    className="relative w-full h-full object-contain drop-shadow-[0_0_30px_rgba(176,80,255,0.4)]"
                    data-testid="avatar-image"
                />
            </div>

            {/* scanlines when glitching */}
            {glitching && <div className="absolute inset-0 scanlines pointer-events-none" />}
        </div>
    );
}