import asyncio
import os
import time
import logging
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
from prisma import Prisma
from dotenv import load_dotenv

from admin_state import add_log, create_upload, get_vector_status, list_logs, list_uploads
from admin_ui import render_admin_html
from services.rag_service import process_and_ingest_pdf
from services.ai_service import generate_question_clone

load_dotenv()
os.environ.setdefault("DATABASE_URL", "file:./dev.db")

app = FastAPI(title="CAT Prep API")
db = Prisma()
db_connected = False


class AdminLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord):
        try:
            logger_name = record.name or "backend"
            message = f"[{logger_name}] {record.getMessage()}"
            level = (record.levelname or "INFO").lower()
            add_log(message, level=level)
        except Exception:
            pass


def _configure_admin_logging():
    handler = AdminLogHandler()
    handler.setLevel(logging.INFO)

    for logger_name in ("uvicorn.error", "cat_backend"):
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.INFO)
        if not any(isinstance(existing, AdminLogHandler) for existing in logger.handlers):
            logger.addHandler(handler)


_configure_admin_logging()
backend_logger = logging.getLogger("cat_backend")


def _fallback_clone(topic: str, difficulty: str):
    return {
        "question_text": f"If three students solve {topic.lower()} problems of {difficulty.lower()} difficulty in a fixed ratio of 2:3:5, and together they solve 50 problems, how many problems does the second student solve?",
        "options": ["10", "12", "15", "18"],
        "answer": "15",
        "concept_hint": "Translate the ratio into parts, find the value of one part, then multiply by the second student's share.",
    }


def _get_uploads(
    file: Optional[UploadFile],
    files: Optional[List[UploadFile]],
) -> List[UploadFile]:
    uploads: List[UploadFile] = []
    if file is not None:
        uploads.append(file)
    if files:
        uploads.extend(files)

    if not uploads:
        raise HTTPException(status_code=400, detail="At least one PDF file is required")

    invalid_files = [upload.filename or "<unnamed>" for upload in uploads if not (upload.filename or "").lower().endswith(".pdf")]
    if invalid_files:
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF files are allowed. Invalid files: {', '.join(invalid_files)}",
        )

    return uploads


def _get_cors_origins() -> List[str]:
    raw_origins = os.environ.get(
        "BACKEND_CORS_ORIGINS",
        "http://127.0.0.1:3001,http://localhost:3001,http://127.0.0.1:3000,http://localhost:3000",
    )
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    if request.url.path.startswith("/admin/api/logs"):
        return await call_next(request)

    started = time.perf_counter()
    add_log(f"{request.method} {request.url.path} started", level="info")
    try:
        response = await call_next(request)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        add_log(
            f"{request.method} {request.url.path} -> {response.status_code} in {elapsed_ms}ms",
            level="success" if response.status_code < 400 else "error",
        )
        return response
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        add_log(
            f"{request.method} {request.url.path} failed in {elapsed_ms}ms: {exc}",
            level="error",
        )
        raise


@app.on_event("startup")
async def startup():
    global db_connected
    try:
        await db.connect()
        db_connected = True
        backend_logger.info("Backend startup complete. Prisma connected.")
    except Exception as exc:
        db_connected = False
        backend_logger.warning("Backend startup completed without Prisma connection: %s", exc)

@app.on_event("shutdown")
async def shutdown():
    backend_logger.info("Backend shutdown started.")
    if db_connected:
        await db.disconnect()
        backend_logger.info("Backend shutdown complete. Prisma disconnected.")
    else:
        backend_logger.info("Backend shutdown complete. Prisma was not connected.")

@app.get("/")
def read_root():
    return {"message": "Welcome to CAT Prep API"}


@app.get("/healthz")
def healthcheck():
    return {"status": "ok"}


@app.get("/puter-bridge", response_class=HTMLResponse)
def puter_bridge():
    return """
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Puter Bridge</title>
      <script src="https://js.puter.com/v2/"></script>
      <style>
        body { margin: 0; background: #0f131d; font-family: sans-serif; }
      </style>
    </head>
    <body>
    <script>
      function sendToRN(type, payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
      }

      setInterval(function() {
        try {
          const signedIn = puter.auth.isSignedIn();
          sendToRN('auth_status', { signedIn: signedIn });
        } catch(e) {
          sendToRN('auth_status', { signedIn: false });
        }
      }, 1000);

      window.addEventListener('message', async function(event) {
        try {
          const msg = JSON.parse(event.data);

          if (msg.action === 'sign_in') {
            try {
              await puter.auth.signIn();
              const user = await puter.auth.getUser();
              sendToRN('auth_result', { success: true, username: user.username });
            } catch(e) {
              sendToRN('auth_result', { success: false, error: e.message || 'Sign in failed' });
            }
          }

          else if (msg.action === 'sign_out') {
            puter.auth.signOut();
            sendToRN('auth_status', { signedIn: false });
          }

          else if (msg.action === 'chat') {
            const response = await puter.ai.chat(msg.prompt, {
              model: msg.model || 'gpt-4o-mini'
            });

            let text = '';
            if (typeof response === 'string') {
              text = response;
            } else if (response && response.message && response.message.content) {
              text = response.message.content;
            } else if (response && response.text) {
              text = response.text;
            } else {
              text = JSON.stringify(response);
            }

            sendToRN('chat_result', { success: true, text: text, requestId: msg.requestId });
          }

        } catch(e) {
          sendToRN('error', { message: e.message || 'Unknown error', requestId: (JSON.parse(event.data)).requestId });
        }
      });

      document.addEventListener('message', function(event) {
        window.dispatchEvent(new MessageEvent('message', { data: event.data }));
      });
    </script>
    </body>
    </html>
    """


@app.get("/admin", response_class=HTMLResponse)
def admin_page():
    return render_admin_html()


@app.get("/admin/api/logs")
def admin_logs():
    return list_logs()


@app.get("/admin/api/uploads")
def admin_uploads():
    return list_uploads()


@app.get("/admin/api/vector-status")
def admin_vector_status():
    return get_vector_status()

@app.post("/upload-pdf/")
@app.post("/upload-pdfs/")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
):
    if not os.environ.get("GEMINI_API_KEY") or not os.environ.get("PINECONE_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="AI services are not configured. Set GEMINI_API_KEY and PINECONE_API_KEY in backend/.env.",
        )

    uploads = _get_uploads(file, files)
    backend_logger.info("Queueing %s upload(s) for background processing.", len(uploads))
    queued_files: List[str] = []
    for upload in uploads:
        file_content = await upload.read()
        filename = upload.filename or "uploaded.pdf"
        upload_record = create_upload(filename, len(file_content))
        background_tasks.add_task(process_and_ingest_pdf, file_content, filename, upload_record["id"])
        queued_files.append(filename)

    return {
        "message": "PDF upload queued successfully. Processing in background.",
        "count": len(queued_files),
        "files": queued_files,
    }

class CloneRequest(BaseModel):
    topic: str
    difficulty: str = "Medium"

@app.post("/generate-clone/")
async def generate_clone(request: CloneRequest):
    try:
        clone = await asyncio.to_thread(generate_question_clone, request.topic, request.difficulty)
    except Exception as exc:
        add_log(
            f"Falling back to local clone for topic={request.topic!r}, difficulty={request.difficulty!r}: {exc}",
            level="warning",
        )
        clone = _fallback_clone(request.topic, request.difficulty)
    return {"clone": clone}

# --- DB Routes ---
@app.get("/questions/")
async def get_questions():
    if not db_connected:
        return []

    try:
        questions = await db.question.find_many(take=10)
        return questions
    except Exception as exc:
        backend_logger.warning("Failed to read questions from Prisma: %s", exc)
        return []

@app.get("/flashcards/")
async def get_flashcards():
    flashcards = []

    # In a real app, you'd filter by due date: db.flashcardreview.find_many(where={"nextReviewDate": {"lte": datetime.now()}})
    if db_connected:
        try:
            flashcards = await db.flashcard.find_many(take=25)
        except Exception as exc:
            backend_logger.warning("Failed to read flashcards from Prisma: %s", exc)
    
    # If DB is empty, return dummy data to prevent frontend crash
    if not flashcards:
        return [
            {
                "id": "dummy-1",
                "topic": "Probability",
                "front": "Bayes' Theorem Formula",
                "back": "P(A|B) = [P(B|A) * P(A)] / P(B)",
                "explanation": "Describes the probability of an event, based on prior knowledge of conditions that might be related to the event."
            }
        ]
    return flashcards

class FlashcardGenerateRequest(BaseModel):
    topic: str
    count: int = 5

@app.post("/generate-flashcards/")
async def generate_flashcards(request: FlashcardGenerateRequest):
    """Generate AI-powered flashcards for a given topic."""
    import json
    from google import genai

    prompt = f"""You are an expert CAT exam tutor. Generate {request.count} high-quality flashcards for the topic: "{request.topic}".
Each flashcard should have:
- front: A concise question, formula name, or concept title
- back: The answer, formula, or key definition
- explanation: A brief explanation of why this is important for CAT
- topic: "{request.topic}"

Return ONLY a valid JSON array: [{{"front": "...", "back": "...", "explanation": "...", "topic": "{request.topic}"}}]"""

    try:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=genai.types.GenerateContentConfig(response_mime_type="application/json"),
            )
            cards = json.loads(response.text)
        else:
            raise RuntimeError("No Gemini key")
    except Exception as exc:
        backend_logger.warning("Gemini flashcard generation failed: %s", exc)
        # Puter fallback
        puter_key = os.environ.get("PUTER_API_KEY")
        if puter_key:
            import openai
            puter_client = openai.OpenAI(api_key=puter_key, base_url="https://api.puter.com/puterai/openai/v1/")
            completion = puter_client.chat.completions.create(
                model="claude-3-5-sonnet",
                messages=[{"role": "user", "content": prompt}]
            )
            content = completion.choices[0].message.content.strip()
            if content.startswith("```json"): content = content[7:-3].strip()
            elif content.startswith("```"): content = content[3:-3].strip()
            cards = json.loads(content)
        else:
            # Hardcoded fallback
            cards = [
                {"front": f"{request.topic}: Key Formula", "back": "Review this topic in your study material", "explanation": "AI generation temporarily unavailable", "topic": request.topic}
            ]

    # Add unique IDs
    import uuid
    for card in cards:
        card["id"] = str(uuid.uuid4())

    return {"flashcards": cards, "count": len(cards)}

class FlashcardReviewRequest(BaseModel):
    flashcardId: str
    difficulty: str # "Hard", "Good", "Easy"

@app.post("/flashcards/review")
async def review_flashcard(request: FlashcardReviewRequest):
    # Here you would calculate the next review date using an SRS algorithm (like SuperMemo-2)
    # and update/create the FlashcardReview record.
    return {"message": "Review saved", "next_interval": "10m" if request.difficulty == "Good" else "1m"}

class MockExamSubmitRequest(BaseModel):
    answers: dict
    timeTaken: str

@app.post("/mock-exam/submit")
async def submit_mock_exam(request: MockExamSubmitRequest):
    return {"message": "Exam submitted successfully", "score": "98.5 %ile"}

@app.get("/analytics/")
async def get_analytics():
    # In a real app, query the MockTest, QuestionAttempt tables.
    # Returning dummy matching the frontend for now.
    return {
        "totalTests": 14,
        "currentStreak": 12,
        "globalAccuracy": 84,
        "netScoreTrend": [
            {"value": 65, "label": "M1"},
            {"value": 72, "label": "M2"},
            {"value": 68, "label": "M3"},
            {"value": 85, "label": "M4"},
            {"value": 82, "label": "M5"},
            {"value": 95, "label": "M6"},
            {"value": 105, "label": "M7"}
        ],
        "sectionalAccuracy": [
            {"value": 75, "label": "Quants", "frontColor": "#6f00be"},
            {"value": 88, "label": "DILR", "frontColor": "#a4c9ff"},
            {"value": 92, "label": "VARC", "frontColor": "#ff7e2d"}
        ],
        "criticalAlert": "Average time on Quantitative Aptitude exceeds 150 seconds. AI recommends reviewing time management strategies for Algebra modules."
    }
