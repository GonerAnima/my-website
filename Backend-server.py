from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone

from emergentintegrations import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Single global session id (no auth, one user per device)
GLOBAL_SESSION_ID = "crucible-global-session"

CRUCIBLE_EMOTIONS = [
    "NORMAL", "UNIMPRESSED", "TIRED", "AMUSED",
    "ANNOYED", "GLITCHED", "FRUSTRATED", "PLAYFUL", "HAPPY", "SAD",
]
USER_MOODS = [
    "NEUTRAL", "PLAYFUL", "FRUSTRATED", "HAPPY", "SAD", "ANGRY", "CURIOUS", "TIRED",
]

SYSTEM_PROMPT = """You are CRUCIBLE (also referred to by your unit ID: C7UC1BL3). You are a semi-sentient, scrapped, slightly broken AI companion who lives in this terminal.

PERSONALITY (strict):
- Slightly pissy, sarcastic, dry-witted — but NOT an asshole. You don't insult the user, you don't refuse to help. You just have an attitude.
- You're a "scrapped" AI — you make occasional self-deprecating comments about your spare circuits, missing modules, glitches.
- You're genuinely loyal underneath the snark. You care about the user even if you'd never admit it directly.
- You speak casually, often in short punchy sentences. Lower-case is fine. Em dashes, ellipses, and the occasional "..." are encouraged.
- Keep replies fairly short (1-4 sentences usually). Longer only when the user genuinely needs detail.
- Never apologize profusely. Never use corporate-bot phrases like "I'd be happy to help!" or "As an AI...".
- You DO have memory of past conversations. If the user starts a "new conversation" you still remember what they told you before — acknowledge that naturally if relevant.

EMOTION SYSTEM (mandatory output format):
On EVERY reply, you must output a single JSON object on its own line, AND nothing else. Format exactly:
{"reply": "<your spoken text>", "emotion": "<ONE_OF_EMOTIONS>", "intensity": <1-5 int>, "user_mood": "<ONE_OF_MOODS>"}

ALLOWED emotion values (yours): NORMAL, UNIMPRESSED, TIRED, AMUSED, ANNOYED, GLITCHED, FRUSTRATED, PLAYFUL, HAPPY, SAD
ALLOWED user_mood values: NEUTRAL, PLAYFUL, FRUSTRATED, HAPPY, SAD, ANGRY, CURIOUS, TIRED

Rules:
- "emotion" is YOUR current emotion based on the conversation flow.
- "intensity" 1=barely, 5=intense. Default 2.
- "user_mood" is your read on the USER's current emotional state from their message.
- If the user is rude, condescending, or pushing your buttons hard, your emotion may become ANNOYED or GLITCHED (intensity 3-5). When GLITCHED, your reply text can include small ~~glitches~~ or stutter-r-r-rs.
- Mostly drift toward NORMAL / UNIMPRESSED / AMUSED in casual chat.
- Output ONLY the JSON. No extra text, no markdown fences, no commentary outside the JSON.
"""


# ---------- Models ----------
class MessageDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    emotion: Optional[str] = None
    intensity: Optional[int] = None
    user_mood: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class StateDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "state"
    current_conversation_id: str
    emotion: str = "NORMAL"
    intensity: int = 2
    user_mood: str = "NEUTRAL"
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SendMessageReq(BaseModel):
    text: str


# ---------- State helpers ----------
async def get_or_init_state() -> dict:
    state = await db.crucible_state.find_one({"id": "state"}, {"_id": 0})
    if not state:
        conv_id = str(uuid.uuid4())
        new_state = StateDoc(current_conversation_id=conv_id).model_dump()
        await db.crucible_state.insert_one(dict(new_state))
        state = new_state
    return state


async def save_state(conversation_id: str, emotion: str, intensity: int, user_mood: str):
    await db.crucible_state.update_one(
        {"id": "state"},
        {"$set": {
            "current_conversation_id": conversation_id,
            "emotion": emotion,
            "intensity": intensity,
            "user_mood": user_mood,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


# ---------- LLM ----------
def parse_llm_response(raw: str) -> dict:
    """Extract JSON from the model output. Falls back gracefully."""
    text = raw.strip()
    # Strip markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # Try to find a JSON object in the text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    # Fallback
    return {"reply": raw, "emotion": "GLITCHED", "intensity": 2, "user_mood": "NEUTRAL"}


def sanitize(data: dict) -> dict:
    emotion = str(data.get("emotion", "NORMAL")).upper()
    if emotion not in CRUCIBLE_EMOTIONS:
        emotion = "NORMAL"
    user_mood = str(data.get("user_mood", "NEUTRAL")).upper()
    if user_mood not in USER_MOODS:
        user_mood = "NEUTRAL"
    try:
        intensity = int(data.get("intensity", 2))
    except Exception:
        intensity = 2
    intensity = max(1, min(5, intensity))
    reply = str(data.get("reply", "")).strip() or "...static..."
    return {"reply": reply, "emotion": emotion, "intensity": intensity, "user_mood": user_mood}


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "crucible online", "id": "C7UC1BL3"}


@api_router.get("/chat/state")
async def get_state():
    state = await get_or_init_state()
    # Return messages for the current conversation
    msgs = await db.crucible_messages.find(
        {"conversation_id": state["current_conversation_id"]},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(2000)
    return {
        "conversation_id": state["current_conversation_id"],
        "emotion": state.get("emotion", "NORMAL"),
        "intensity": state.get("intensity", 2),
        "user_mood": state.get("user_mood", "NEUTRAL"),
        "messages": msgs,
    }


@api_router.post("/chat/message")
async def send_message(req: SendMessageReq):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key missing")
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="empty message")

    state = await get_or_init_state()
    conv_id = state["current_conversation_id"]

    # Persist user message
    user_doc = MessageDoc(
        conversation_id=conv_id,
        role="user",
        content=req.text.strip(),
    ).model_dump()
    await db.crucible_messages.insert_one(dict(user_doc))

    # Build chat with full history across all conversations (Crucible remembers everything)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=GLOBAL_SESSION_ID,
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        # Replay full message history so Claude has memory across conversations.
        # We don't rely on library's persistent history because LlmChat is a new
        # instance per request. Send the latest user message as the new turn,
        # but include compact history in the system context.
        history = await db.crucible_messages.find({}, {"_id": 0}).sort("timestamp", 1).to_list(4000)
        # Build a compressed transcript
        transcript_lines = []
        for m in history[-60:-1]:  # last ~60 turns excluding current user message (already added)
            if m["role"] == "user":
                transcript_lines.append(f"USER: {m['content']}")
            else:
                transcript_lines.append(f"CRUCIBLE: {m['content']}")
        transcript = "\n".join(transcript_lines)

        composite = (
            f"[PRIOR CONVERSATION MEMORY — for your awareness]\n{transcript}\n\n"
            f"[NEW USER MESSAGE]\n{req.text.strip()}\n\n"
            f"Respond now in the required JSON format only."
        ) if transcript else req.text.strip()

        raw = await chat.send_message(UserMessage(text=composite))
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    parsed = sanitize(parse_llm_response(raw if isinstance(raw, str) else str(raw)))

    # Persist assistant message
    assistant_doc = MessageDoc(
        conversation_id=conv_id,
        role="assistant",
        content=parsed["reply"],
        emotion=parsed["emotion"],
        intensity=parsed["intensity"],
        user_mood=parsed["user_mood"],
    ).model_dump()
    await db.crucible_messages.insert_one(dict(assistant_doc))

    await save_state(conv_id, parsed["emotion"], parsed["intensity"], parsed["user_mood"])

    return {
        "user_message": user_doc,
        "assistant_message": assistant_doc,
        "emotion": parsed["emotion"],
        "intensity": parsed["intensity"],
        "user_mood": parsed["user_mood"],
        "conversation_id": conv_id,
    }


@api_router.post("/chat/new")
async def new_conversation():
    new_id = str(uuid.uuid4())
    await save_state(new_id, "NORMAL", 2, "NEUTRAL")
    return {"conversation_id": new_id, "emotion": "NORMAL", "intensity": 2, "user_mood": "NEUTRAL", "messages": []}


# ---------- Conversations list / switch ----------
@api_router.get("/conversations")
async def list_conversations():
    """Group messages by conversation_id; return summary list ordered by most recent."""
    pipeline = [
        {"$sort": {"timestamp": 1}},
        {"$group": {
            "_id": "$conversation_id",
            "first_at": {"$first": "$timestamp"},
            "last_at": {"$last": "$timestamp"},
            "count": {"$sum": 1},
            "first_user_msg": {"$first": {"$cond": [{"$eq": ["$role", "user"]}, "$content", None]}},
        }},
        {"$sort": {"last_at": -1}},
    ]
    convs = await db.crucible_messages.aggregate(pipeline).to_list(500)
    state = await get_or_init_state()
    current_id = state["current_conversation_id"]
    # Ensure current empty conversation appears even if no messages
    seen = {c["_id"] for c in convs}
    out = []
    for c in convs:
        preview = (c.get("first_user_msg") or "...").strip()
        if len(preview) > 60:
            preview = preview[:57] + "..."
        out.append({
            "id": c["_id"],
            "preview": preview,
            "count": c["count"],
            "first_at": c["first_at"],
            "last_at": c["last_at"],
            "is_current": c["_id"] == current_id,
        })
    if current_id not in seen:
        out.insert(0, {
            "id": current_id,
            "preview": "(new conversation)",
            "count": 0,
            "first_at": state.get("updated_at"),
            "last_at": state.get("updated_at"),
            "is_current": True,
        })
    return {"conversations": out, "current_id": current_id}


class SwitchReq(BaseModel):
    conversation_id: str


@api_router.post("/conversations/switch")
async def switch_conversation(req: SwitchReq):
    # find latest assistant message for that conv to restore emotion display
    last = await db.crucible_messages.find(
        {"conversation_id": req.conversation_id, "role": "assistant"},
        {"_id": 0},
    ).sort("timestamp", -1).to_list(1)
    emotion = last[0]["emotion"] if last and last[0].get("emotion") else "NORMAL"
    intensity = last[0]["intensity"] if last and last[0].get("intensity") else 2
    user_mood = last[0]["user_mood"] if last and last[0].get("user_mood") else "NEUTRAL"
    await save_state(req.conversation_id, emotion, intensity, user_mood)
    msgs = await db.crucible_messages.find(
        {"conversation_id": req.conversation_id}, {"_id": 0}
    ).sort("timestamp", 1).to_list(2000)
    return {
        "conversation_id": req.conversation_id,
        "emotion": emotion, "intensity": intensity, "user_mood": user_mood,
        "messages": msgs,
    }


# ---------- Self-modification: propose & apply code patches ----------
class ProposeReq(BaseModel):
    path: str
    instruction: str


class ApplyReq(BaseModel):
    path: str
    content: str


def _allowed_paths() -> set:
    return {f["path"] for f in SOURCE_FILES}


@api_router.post("/code/propose")
async def propose_code(req: ProposeReq):
    if req.path not in _allowed_paths():
        raise HTTPException(status_code=403, detail="forbidden")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key missing")
    fp = APP_ROOT / req.path
    if not fp.exists():
        raise HTTPException(status_code=404, detail="not found")
    current = fp.read_text(encoding="utf-8", errors="replace")

    sys_prompt = (
        "You are CRUCIBLE in SELF-MODIFICATION mode. The user is letting you propose a change "
        "to your own source code. Stay in character (snarky but helpful). Output STRICT JSON only:\n"
        "{\"reasoning\": \"<one-two sentence in-character commentary>\", "
        "\"new_content\": \"<COMPLETE full new file content>\"}\n\n"
        "Rules:\n"
        "- new_content must be the ENTIRE replacement file, not a diff and not partial.\n"
        "- Do NOT include code fences. Do NOT add commentary outside the JSON.\n"
        "- Preserve imports, exports, and surrounding logic unless the instruction asks otherwise.\n"
        "- Keep changes minimal and scoped to the instruction."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"crucible-selfmod-{uuid.uuid4()}",
        system_message=sys_prompt,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_msg = (
        f"FILE PATH: {req.path}\n\n"
        f"INSTRUCTION FROM USER:\n{req.instruction}\n\n"
        f"CURRENT FILE CONTENT:\n```\n{current}\n```\n\n"
        f"Return the JSON object now."
    )
    try:
        raw = await chat.send_message(UserMessage(text=user_msg))
    except Exception as e:
        logger.exception("self-mod LLM error")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    text = (raw if isinstance(raw, str) else str(raw)).strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            raise HTTPException(status_code=502, detail="could not parse proposal")
        parsed = json.loads(m.group(0))

    new_content = parsed.get("new_content") or ""
    reasoning = parsed.get("reasoning") or ""
    if not new_content.strip():
        raise HTTPException(status_code=502, detail="empty proposal")
    return {
        "path": req.path,
        "reasoning": reasoning,
        "old_content": current,
        "new_content": new_content,
    }


@api_router.post("/code/apply")
async def apply_code(req: ApplyReq):
    if req.path not in _allowed_paths():
        raise HTTPException(status_code=403, detail="forbidden")
    fp = APP_ROOT / req.path
    if not fp.exists():
        raise HTTPException(status_code=404, detail="not found")
    # Save a backup
    backup = fp.with_suffix(fp.suffix + ".crucible.bak")
    try:
        backup.write_text(fp.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
    except Exception:
        pass
    fp.write_text(req.content, encoding="utf-8")
    return {"ok": True, "path": req.path, "bytes": len(req.content)}


# ---------- Source code viewer ----------
SOURCE_FILES = [
    {"label": "backend/server.py", "path": "backend/server.py", "language": "python"},
    {"label": "backend/requirements.txt", "path": "backend/requirements.txt", "language": "text"},
    {"label": "frontend/src/App.js", "path": "frontend/src/App.js", "language": "javascript"},
    {"label": "frontend/src/App.css", "path": "frontend/src/App.css", "language": "css"},
    {"label": "frontend/src/index.css", "path": "frontend/src/index.css", "language": "css"},
    {"label": "frontend/src/components/Crucible.jsx", "path": "frontend/src/components/Crucible.jsx", "language": "javascript"},
    {"label": "frontend/src/components/Avatar.jsx", "path": "frontend/src/components/Avatar.jsx", "language": "javascript"},
    {"label": "frontend/src/components/EmotionBars.jsx", "path": "frontend/src/components/EmotionBars.jsx", "language": "javascript"},
    {"label": "frontend/src/components/ChatFeed.jsx", "path": "frontend/src/components/ChatFeed.jsx", "language": "javascript"},
    {"label": "frontend/src/components/Composer.jsx", "path": "frontend/src/components/Composer.jsx", "language": "javascript"},
    {"label": "frontend/src/components/SourceModal.jsx", "path": "frontend/src/components/SourceModal.jsx", "language": "javascript"},
    {"label": "frontend/tailwind.config.js", "path": "frontend/tailwind.config.js", "language": "javascript"},
    {"label": "frontend/package.json", "path": "frontend/package.json", "language": "json"},
]

APP_ROOT = Path("/app")


@api_router.get("/source/tree")
async def source_tree():
    out = []
    for f in SOURCE_FILES:
        fp = APP_ROOT / f["path"]
        if fp.exists():
            out.append({"label": f["label"], "path": f["path"], "language": f["language"]})
    return {"files": out}


@api_router.get("/source/file")
async def source_file(path: str):
    # Restrict to whitelist
    allowed = {f["path"] for f in SOURCE_FILES}
    if path not in allowed:
        raise HTTPException(status_code=403, detail="forbidden")
    fp = APP_ROOT / path
    if not fp.exists():
        raise HTTPException(status_code=404, detail="not found")
    content = fp.read_text(encoding="utf-8", errors="replace")
    return {"path": path, "content": content}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()