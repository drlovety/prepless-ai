"""
main.py — Polling worker for PrepLess AI
Polls Supabase for pending lessons, runs the hermes_flow pipeline,
and uploads results to Supabase Storage.
"""
import json
import os
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from dotenv import load_dotenv
from supabase import create_client, Client

from pipeline import run_pipeline
from builders import build_pptx, build_docx

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")

BUCKET_NAME = "lesson-files"


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def poll_pending(supabase: Client) -> Optional[Dict]:
    """Fetch the oldest pending lesson."""
    try:
        resp = supabase.table("lessons").select("*").eq("status", "pending").order("created_at", desc=False).limit(1).execute()
        rows = resp.data or []
        if rows:
            return rows[0]
    except Exception as e:
        print(f"[poll] Error fetching pending: {e}")
    return None


def upload_file(supabase: Client, file_path: Path, bucket: str, storage_path: str) -> Optional[str]:
    """Upload a file to Supabase Storage. Returns public URL or None."""
    try:
        with open(file_path, "rb") as f:
            supabase.storage.from_(bucket).upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "application/octet-stream", "upsert": "true"},
            )
        # Get public URL
        url = supabase.storage.from_(bucket).get_public_url(storage_path)
        return url
    except Exception as e:
        print(f"[upload] Error uploading {storage_path}: {e}")
        return None


def process_lesson(supabase: Client, lesson: Dict):
    """Run the full pipeline for one lesson."""
    lesson_id = lesson["id"]
    user_id = lesson["user_id"]
    source_text = lesson.get("source_text", "")

    # Extract config from pending marker in generated_json
    generated_json = lesson.get("generated_json", {}) or {}
    if generated_json.get("_pending") is True:
        config = generated_json.get("config", {})
        if not source_text:
            source_text = generated_json.get("source_text", "")
    else:
        # Fallback: try to reconstruct config from lesson fields
        config = {
            "class_name": lesson.get("class_name", ""),
            "topic": lesson.get("topic", ""),
        }

    print(f"\n{'='*60}")
    print(f"[process] Lesson {lesson_id} — {config.get('topic', 'Untitled')}")
    print(f"{'='*60}")

    # Mark as generating
    try:
        supabase.table("lessons").update({"status": "generating"}).eq("id", lesson_id).execute()
    except Exception as e:
        print(f"[process] Failed to mark generating: {e}")

    # Run pipeline
    data, issues = run_pipeline(source_text, config)
    if not data:
        print(f"[process] Pipeline failed for lesson {lesson_id}")
        try:
            supabase.table("lessons").update({
                "status": "failed",
                "generated_json": {"error": "Pipeline failed", "audit_issues": issues}
            }).eq("id", lesson_id).execute()
        except Exception as e:
            print(f"[process] Failed to mark failed: {e}")
        return

    # Store generated JSON
    try:
        supabase.table("lessons").update({
            "generated_json": data,
            "status": "building"
        }).eq("id", lesson_id).execute()
    except Exception as e:
        print(f"[process] Failed to store JSON: {e}")

    # Build files
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)

        # PPTX
        pptx_path = tmp_dir / "lesson.pptx"
        try:
            build_pptx(data, pptx_path, tmp_dir)
            pptx_storage_path = f"{user_id}/{lesson_id}/lesson.pptx"
            pptx_url = upload_file(supabase, pptx_path, BUCKET_NAME, pptx_storage_path)
        except Exception as e:
            print(f"[process] PPTX build failed: {e}")
            pptx_url = None

        # Lesson DOCX
        lesson_docx_path = tmp_dir / "lesson.docx"
        try:
            build_docx(data, lesson_docx_path, doc_type="lesson")
            lesson_storage_path = f"{user_id}/{lesson_id}/lesson.docx"
            lesson_url = upload_file(supabase, lesson_docx_path, BUCKET_NAME, lesson_storage_path)
        except Exception as e:
            print(f"[process] Lesson DOCX build failed: {e}")
            lesson_url = None

        # Activity DOCX
        activity_docx_path = tmp_dir / "activity.docx"
        try:
            build_docx(data, activity_docx_path, doc_type="activity")
            activity_storage_path = f"{user_id}/{lesson_id}/activity.docx"
            activity_url = upload_file(supabase, activity_docx_path, BUCKET_NAME, activity_storage_path)
        except Exception as e:
            print(f"[process] Activity DOCX build failed: {e}")
            activity_url = None

        # Update lesson with file URLs
        files_meta = {
            "pptx_url": pptx_url,
            "lesson_docx_url": lesson_url,
            "activity_docx_url": activity_url,
            "audit_issues": issues,
        }

        try:
            # Merge into generated_json
            data["_files"] = files_meta
            supabase.table("lessons").update({
                "generated_json": data,
                "status": "complete"
            }).eq("id", lesson_id).execute()
            print(f"[process] Lesson {lesson_id} complete. Files uploaded.")
        except Exception as e:
            print(f"[process] Failed to mark complete: {e}")


def ensure_bucket(supabase: Client):
    """Ensure the storage bucket exists."""
    try:
        buckets = supabase.storage.list_buckets()
        names = [b.name for b in buckets]
        if BUCKET_NAME not in names:
            print(f"[init] Creating bucket {BUCKET_NAME}...")
            supabase.storage.create_bucket(BUCKET_NAME, options={"public": True})
            print(f"[init] Bucket {BUCKET_NAME} created")
    except Exception as e:
        print(f"[init] Bucket check/create error (may already exist): {e}")


def main():
    print("=" * 60)
    print("PrepLess AI Worker")
    print(f"Supabase: {SUPABASE_URL}")
    print(f"Poll interval: {POLL_INTERVAL}s")
    print("=" * 60)

    supabase = get_supabase()
    ensure_bucket(supabase)

    print("[main] Starting poll loop...")
    while True:
        try:
            lesson = poll_pending(supabase)
            if lesson:
                process_lesson(supabase, lesson)
            else:
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print("\n[main] Interrupted. Exiting.")
            break
        except Exception as e:
            print(f"[main] Unexpected error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
