import base64
import json
import os
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from model_adapter import build_model  # noqa: E402

MODEL_CHECKPOINT = os.getenv(
    "MODEL_CHECKPOINT",
    str(ROOT.parent / "models" / "E4_v4_cpfedst_stage2.pt"),
)
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"

model = None
startup_error = None

if not DEMO_MODE:
    try:
        model = build_model(MODEL_CHECKPOINT)
    except Exception as exc:  # Keep process alive so Node can report a clear status.
        startup_error = f"{type(exc).__name__}: {exc}"


def demo_prediction(client_id: int):
    return {
        "clientId": client_id,
        "prediction": "demo-mode",
        "classId": None,
        "confidence": 0.0,
        "top5": [],
        "demo": True,
        "message": "Real E4 v4 weights are not loaded. Set DEMO_MODE=false and provide the trained checkpoint plus pfedst_official code.",
    }


for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue

    try:
        req = json.loads(raw)
        req_id = req.get("id")
        client_id = int(req.get("clientId", 0))

        if DEMO_MODE:
            result = demo_prediction(client_id)
        elif model is None:
            raise RuntimeError(startup_error or "Model runtime is not initialized.")
        else:
            image_b64 = req.get("imageBase64")
            if not image_b64:
                raise ValueError("imageBase64 is required")
            image_bytes = base64.b64decode(image_b64)
            result = model.predict(image_bytes, client_id)

        output = {"id": req_id, "ok": True, "result": result}
    except Exception as exc:
        output = {
            "id": req.get("id") if isinstance(req, dict) else None,
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        }
        if os.getenv("DEBUG_MODEL_WORKER", "false").lower() == "true":
            output["traceback"] = traceback.format_exc()

    sys.stdout.write(json.dumps(output) + "\n")
    sys.stdout.flush()
