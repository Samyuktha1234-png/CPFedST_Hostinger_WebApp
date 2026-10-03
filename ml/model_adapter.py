import copy
import os
import sys
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageOps
import torch
import torch.nn.functional as F

CLASS_NAMES = [
    "melanoma",
    "melanocytic nevus",
    "basal cell carcinoma",
    "actinic keratosis",
    "benign keratosis",
    "dermatofibroma",
    "vascular lesion",
    "squamous cell carcinoma",
]


def _add_pfedst_code_path() -> None:
    configured = os.getenv("PFEDST_CODE_DIR", "").strip()
    local_vendor = Path(__file__).resolve().parent / "vendor"
    candidates = []
    if configured:
        candidates.append(Path(configured))
    candidates.append(local_vendor)
    for candidate in candidates:
        if candidate.exists():
            p = str(candidate)
            if p not in sys.path:
                sys.path.insert(0, p)


class CPFedSTModel:
    """Inference wrapper for the final E4 v4 CPFedST checkpoint."""

    def __init__(self, checkpoint_path: str, device: str = "cpu") -> None:
        self.device = torch.device(device)
        _add_pfedst_code_path()

        try:
            from pfedst_official import clip  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "Cannot import pfedst_official. Copy the working package from the training project "
                "to ml/vendor/pfedst_official or set PFEDST_CODE_DIR."
            ) from exc

        checkpoint = Path(checkpoint_path)
        if not checkpoint.exists():
            raise FileNotFoundError(
                f"Model checkpoint not found: {checkpoint}. "
                "Copy E4_v4_cpfedst_stage2.pt into the models folder or set MODEL_CHECKPOINT."
            )

        self.clip = clip
        self.model, _ = clip.load("ViT-B/16", device=str(self.device))
        self.model = self.model.float()

        state = torch.load(
            checkpoint,
            map_location=self.device,
            weights_only=False,
        )
        if not isinstance(state, dict):
            raise ValueError("Unexpected checkpoint format.")
        if "global_model" not in state or "local_models" not in state:
            raise KeyError("Checkpoint must contain global_model and local_models.")
        if len(state["local_models"]) != 4:
            raise ValueError("Expected four personalized client models in the checkpoint.")

        self.model.load_state_dict(state["global_model"], strict=True)
        self.client_models: List[torch.nn.Module] = []
        for client_state in state["local_models"]:
            local_model = copy.deepcopy(self.model)
            local_model.load_state_dict(client_state, strict=True)
            local_model.float().eval()
            self.client_models.append(local_model)

        self.model.eval()

        prompts = [f"a photo of {name}." for name in CLASS_NAMES]
        text_tokens = self.clip.tokenize(prompts).to(self.device)
        with torch.no_grad():
            text_features = self.model.encode_text(text_tokens).float()
            self.text_features = F.normalize(text_features, dim=-1)

        self.logit_scale = self.model.logit_scale.exp().detach()
        self.parameter_count = sum(
            p.numel() for name, p in self.model.named_parameters() if "side" in name
        )

    @staticmethod
    def _preprocess(image_bytes: bytes) -> torch.Tensor:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        width, height = image.size
        scale = max(224 / max(width, 1), 224 / max(height, 1), 1.0)
        if scale > 1.0:
            new_size = (int(round(width * scale)), int(round(height * scale)))
            image = image.resize(new_size, Image.Resampling.BICUBIC)
        image = ImageOps.fit(
            image,
            (224, 224),
            method=Image.Resampling.BICUBIC,
            centering=(0.5, 0.5),
        )
        arr = np.asarray(image).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
        tensor = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0).float()
        return tensor

    @torch.inference_mode()
    def predict(self, image_bytes: bytes, client_id: int) -> Dict:
        if client_id < 0 or client_id >= len(self.client_models):
            raise ValueError("client_id must be one of 0, 1, 2, 3")

        image = self._preprocess(image_bytes).to(self.device)
        client_model = self.client_models[client_id]
        client_model.eval()

        local_features = client_model.encode_image(image, p_flag=True).float()
        local_features = F.normalize(local_features, dim=-1)
        logits = self.logit_scale * (local_features @ self.text_features.T)
        probabilities = torch.softmax(logits, dim=-1)[0]
        top_values, top_indices = torch.topk(probabilities, k=min(5, len(CLASS_NAMES)))

        items = []
        for score, idx in zip(top_values.tolist(), top_indices.tolist()):
            items.append({
                "classId": int(idx),
                "className": CLASS_NAMES[idx],
                "probability": float(score),
            })

        best = items[0]
        return {
            "clientId": client_id,
            "prediction": best["className"],
            "classId": best["classId"],
            "confidence": best["probability"],
            "top5": items,
        }


def build_model(checkpoint_path: Optional[str]) -> Optional[CPFedSTModel]:
    if not checkpoint_path:
        return None
    return CPFedSTModel(checkpoint_path=checkpoint_path, device=os.getenv("MODEL_DEVICE", "cpu"))
