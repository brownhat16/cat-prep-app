import os
from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Deque, Dict, List, Optional
from uuid import uuid4

from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

_LOGS: Deque[Dict[str, Any]] = deque(maxlen=500)
_UPLOADS: Deque[Dict[str, Any]] = deque(maxlen=100)
_UPLOAD_INDEX: Dict[str, Dict[str, Any]] = {}
_LOCK = Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def add_log(message: str, level: str = "info", upload_id: Optional[str] = None):
    entry = {
        "timestamp": _now(),
        "level": level,
        "message": message,
        "upload_id": upload_id,
    }
    with _LOCK:
        _LOGS.append(entry)


def list_logs(limit: int = 200) -> List[Dict[str, Any]]:
    with _LOCK:
        return list(_LOGS)[-limit:]


def create_upload(filename: str, size_bytes: int) -> Dict[str, Any]:
    upload = {
        "id": str(uuid4()),
        "filename": filename,
        "size_bytes": size_bytes,
        "status": "queued",
        "attempts": 0,
        "queued_at": _now(),
        "started_at": None,
        "completed_at": None,
        "error": None,
        "last_error": None,
        "next_retry_at": None,
        "vector_count_before": get_vector_count(silent=True),
        "vector_count_after": None,
        "upserted_vectors": None,
    }
    with _LOCK:
        _UPLOADS.append(upload)
        _UPLOAD_INDEX[upload["id"]] = upload
    add_log(f"Queued upload for {filename}", upload_id=upload["id"])
    return upload


def mark_upload_started(upload_id: str):
    with _LOCK:
        upload = _UPLOAD_INDEX.get(upload_id)
        if upload:
            upload["status"] = "processing"
            upload["started_at"] = _now()
            upload["next_retry_at"] = None
    add_log("Upload processing started", upload_id=upload_id)


def mark_upload_attempt(upload_id: str, attempt: int):
    with _LOCK:
        upload = _UPLOAD_INDEX.get(upload_id)
        if upload:
            upload["attempts"] = attempt
            if upload["status"] in {"queued", "retrying"}:
                upload["status"] = "processing"
            upload["next_retry_at"] = None
    add_log(f"Upload attempt #{attempt}", upload_id=upload_id)


def mark_upload_retry(upload_id: str, error: str, retry_at: str):
    with _LOCK:
        upload = _UPLOAD_INDEX.get(upload_id)
        if upload:
            upload["status"] = "retrying"
            upload["last_error"] = error
            upload["next_retry_at"] = retry_at
    add_log(f"Retry scheduled: {error}", level="warning", upload_id=upload_id)


def mark_upload_failed(upload_id: str, error: str):
    with _LOCK:
        upload = _UPLOAD_INDEX.get(upload_id)
        if upload:
            upload["status"] = "failed"
            upload["completed_at"] = _now()
            upload["error"] = error
            upload["last_error"] = error
            upload["next_retry_at"] = None
    add_log(f"Upload failed: {error}", level="error", upload_id=upload_id)


def mark_upload_succeeded(upload_id: str, upserted_vectors: int):
    vector_count_after = get_vector_count(silent=True)
    with _LOCK:
        upload = _UPLOAD_INDEX.get(upload_id)
        if upload:
            upload["status"] = "succeeded"
            upload["completed_at"] = _now()
            upload["error"] = None
            upload["last_error"] = None
            upload["upserted_vectors"] = upserted_vectors
            upload["vector_count_after"] = vector_count_after
            upload["next_retry_at"] = None
    add_log(
        f"Upload succeeded with {upserted_vectors} vectors",
        level="success",
        upload_id=upload_id,
    )


def list_uploads(limit: int = 50) -> List[Dict[str, Any]]:
    with _LOCK:
        return list(_UPLOADS)[-limit:][::-1]


def get_vector_count(silent: bool = False) -> Optional[int]:
    api_key = os.environ.get("PINECONE_API_KEY")
    index_name = os.environ.get("PINECONE_INDEX_NAME")
    if not api_key or not index_name:
        if not silent:
            raise RuntimeError("Missing Pinecone configuration.")
        return None

    try:
        pc = Pinecone(api_key=api_key)
        index = pc.Index(index_name)
        stats = index.describe_index_stats()
        return stats.get("total_vector_count")
    except Exception as exc:
        if not silent:
            raise exc
        return None


def get_vector_status() -> Dict[str, Any]:
    try:
        total_vectors = get_vector_count(silent=False)
        return {
            "status": "ok",
            "total_vectors": total_vectors,
            "checked_at": _now(),
        }
    except Exception as exc:
        return {
            "status": "error",
            "total_vectors": None,
            "checked_at": _now(),
            "error": str(exc),
        }
