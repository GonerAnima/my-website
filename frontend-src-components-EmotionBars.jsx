export default function EmotionBars({ emotion, intensity, userMood }) {
    // user mood intensity is implicit; show 3 bars by default for visualization
    const userIntensity = userMoodIntensity(userMood);
    return (
        <div className="w-full border border-cpurple/30 bg-csurface/40 backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-5 space-y-4" data-testid="bars-container">
            <BarRow
                label="EMOTION"
                state={emotion}
                value={intensity}
                stateClass="text-cpurple"
                testid="emotion-bar"
                segClass="seg"
                activeClass="on"
            />
            <div className="h-px w-full bg-cpurple/15" />
            <BarRow
                label="USER MOOD"
                state={userMood}
                value={userIntensity}
                stateClass="text-ccyan"
                testid="mood-bar"
                segClass="seg"
                activeClass="user-on"
            />
        </div>
    );
}

function BarRow({ label, state, value, stateClass, testid, segClass, activeClass }) {
    return (
        <div data-testid={testid}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs tracking-[0.25em] text-cmuted uppercase">{label}</span>
                <span className={`text-xs sm:text-sm tracking-[0.25em] font-bold uppercase ${stateClass}`} data-testid={`${testid}-state`}>
                    {state}
                </span>
            </div>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`${segClass} ${i <= value ? activeClass : ""}`} />
                ))}
            </div>
        </div>
    );
}

function userMoodIntensity(mood) {
    switch (mood) {
        case "ANGRY":
        case "FRUSTRATED":
            return 5;
        case "SAD":
            return 4;
        case "TIRED":
            return 2;
        case "PLAYFUL":
        case "HAPPY":
            return 4;
        case "CURIOUS":
            return 3;
        default:
            return 2;
    }
}