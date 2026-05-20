import asyncio
import os
import json
import io
import traceback
from datetime import datetime, timedelta, timezone
from typing import Optional

from admin_state import (
    add_log,
    mark_upload_attempt,
    mark_upload_failed,
    mark_upload_retry,
    mark_upload_started,
    mark_upload_succeeded,
)
from google import genai
from pinecone import Pinecone
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

index_name = os.environ.get("PINECONE_INDEX_NAME", "cat-prep-index")


def _get_clients():
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    pinecone_api_key = os.environ.get("PINECONE_API_KEY")
    if not gemini_api_key or not pinecone_api_key:
        raise RuntimeError(
            "AI services are not configured. Set GEMINI_API_KEY and PINECONE_API_KEY in backend/.env."
        )

    client = genai.Client(api_key=gemini_api_key)
    pc = Pinecone(api_key=pinecone_api_key)
    return client, pc


def _log(message: str, upload_id: Optional[str] = None, level: str = "info"):
    print(f"[rag_ingest] {message}", flush=True)
    add_log(message, level=level, upload_id=upload_id)


def _retry_at(delay_seconds: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)).isoformat()


def _is_retryable_error(error: Exception) -> bool:
    message = str(error).lower()
    retry_markers = (
        "503",
        "unavailable",
        "high demand",
        "timeout",
        "timed out",
        "connection reset",
        "temporar",
        "rate limit",
        "resource exhausted",
        "deadline exceeded",
    )
    return any(marker in message for marker in retry_markers)


def _sanitize_metadata_value(value):
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        cleaned_items = []
        for item in value:
            if item is None:
                continue
            if isinstance(item, (str, int, float, bool)):
                cleaned_items.append(str(item))
            else:
                cleaned_items.append(json.dumps(item, ensure_ascii=True))
        return cleaned_items
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=True)
    return str(value)


def _build_pinecone_metadata(question: dict, filename: str) -> dict:
    metadata = {"source_filename": filename}
    for key, value in question.items():
        cleaned_value = _sanitize_metadata_value(value)
        if cleaned_value is None:
            continue
        metadata[key] = cleaned_value
    return metadata


async def _process_and_ingest_pdf_once(file_content: bytes, filename: str, upload_id: Optional[str] = None):
    client, pc = _get_clients()
    import pdfplumber

    _log(f"Started ingest for file={filename!r}, bytes={len(file_content)}", upload_id=upload_id)
    
    text = ""
    with pdfplumber.open(io.BytesIO(file_content)) as pdf:
        _log(f"Opened PDF with {len(pdf.pages)} pages", upload_id=upload_id)
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    extracted_chars = len(text)
    _log(f"Extracted text chars={extracted_chars}", upload_id=upload_id)
    if not text.strip():
        raise ValueError(f"No extractable text found in PDF: {filename}")
    
    # Normally, you'd chunk the text. For now, let's ask Gemini to parse a chunk.
    # In a real scenario, this requires handling token limits.
    chunk = text[:30000] 
    _log(f"Prepared prompt chunk chars={len(chunk)}", upload_id=upload_id)
    
    prompt = """
    Extract CAT exam questions from the following text and return them as a JSON array.
    Format: [{"section": "VARC/DILR/QA", "topic": "...", "question_text": "...", "options": ["A", "B", "C", "D"], "type": "MCQ/TITA", "answer": "...", "concept_hint": "..."}]
    Text:
    """ + chunk
    
    @retry(
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception(_is_retryable_error),
    )
    def _generate_questions():
        return client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
    
    try:
        response = _generate_questions()
        response_text = response.text or ""
    except Exception as e:
        puter_key = os.environ.get("PUTER_API_KEY")
        if puter_key:
            _log(f"Gemini ingest failed, falling back to Puter AI... {e}", upload_id=upload_id, level="warning")
            import openai
            puter_client = openai.OpenAI(api_key=puter_key, base_url="https://api.puter.com/puterai/openai/v1/")
            completion = puter_client.chat.completions.create(
                model="claude-3-5-sonnet",
                messages=[{"role": "user", "content": prompt}]
            )
            content = completion.choices[0].message.content.strip()
            if content.startswith("```json"):
                content = content[7:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
            response_text = content
        else:
            raise e
    
    try:
        questions = json.loads(response_text)
        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]
        if not isinstance(questions, list):
            raise ValueError(f"Expected a JSON array of questions, got {type(questions).__name__}")

        _log(f"Parsed questions count={len(questions)}", upload_id=upload_id)
        index = pc.Index(index_name)
        
        vectors = []
        for idx, q in enumerate(questions, start=1):
            if not isinstance(q, dict):
                _log(
                    f"Skipping question #{idx}: expected object, got {type(q).__name__}",
                    upload_id=upload_id,
                )
                continue

            question_text = q.get("question_text")
            if not question_text:
                _log(f"Skipping question #{idx}: missing question_text", upload_id=upload_id)
                continue

            @retry(
                wait=wait_exponential(multiplier=2, min=4, max=60),
                stop=stop_after_attempt(5),
                retry=retry_if_exception(_is_retryable_error),
            )
            def _embed_question():
                return client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=question_text,
                    config=genai.types.EmbedContentConfig(output_dimensionality=768)
                )

            embed_response = _embed_question()
            embedding = embed_response.embeddings[0].values
            
            # Create a unique ID for pinecone
            import uuid
            q_id = str(uuid.uuid4())
            metadata = _build_pinecone_metadata(q, filename)
            
            vectors.append({
                "id": q_id,
                "values": embedding,
                "metadata": metadata,
            })

            if idx <= 3:
                _log(
                    (
                        f"Embedded question #{idx}: text_chars={len(question_text)}, "
                        f"vector_dim={len(embedding)}, metadata_keys={sorted(metadata.keys())}"
                    ),
                    upload_id=upload_id,
                )
            
            # Save to SQLite via Prisma (this would ideally happen in the background or service layer)
            # await db.question.create(data={...})
        
        if not vectors:
            raise ValueError(f"No vectors generated from parsed questions for file {filename}")

        _log(f"Attempting Pinecone upsert for vectors={len(vectors)}", upload_id=upload_id)
        upsert_response = index.upsert(vectors=vectors)
        _log(f"Pinecone upsert response={upsert_response!r}", upload_id=upload_id)
        print(f"Upserted {len(vectors)} vectors to Pinecone from {filename}")
        return len(vectors)
            
    except Exception as e:
        _log(f"Failed to process and ingest: {e}", upload_id=upload_id, level="error")
        traceback.print_exc()
        raise


async def process_and_ingest_pdf(
    file_content: bytes,
    filename: str,
    upload_id: Optional[str] = None,
    max_attempts: int = 12,
    base_delay_seconds: int = 15,
    max_delay_seconds: int = 300,
):
    if upload_id:
        mark_upload_started(upload_id)

    last_error: Optional[Exception] = None
    for attempt in range(1, max_attempts + 1):
        if upload_id:
            mark_upload_attempt(upload_id, attempt)

        try:
            upserted_vectors = await _process_and_ingest_pdf_once(
                file_content,
                filename,
                upload_id=upload_id,
            )
            if upload_id:
                mark_upload_succeeded(upload_id, upserted_vectors)
            return
        except Exception as exc:
            last_error = exc
            if attempt >= max_attempts or not _is_retryable_error(exc):
                if upload_id:
                    mark_upload_failed(upload_id, str(exc))
                raise

            delay_seconds = min(base_delay_seconds * (2 ** (attempt - 1)), max_delay_seconds)
            retry_at = _retry_at(delay_seconds)
            if upload_id:
                mark_upload_retry(upload_id, str(exc), retry_at)
            _log(
                f"Retrying {filename!r} in {delay_seconds}s after attempt {attempt} failed: {exc}",
                upload_id=upload_id,
                level="warning",
            )
            await asyncio.sleep(delay_seconds)

    if upload_id and last_error is not None:
        mark_upload_failed(upload_id, str(last_error))
    if last_error is not None:
        raise last_error
