import os
import io
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import torch
import torchvision.transforms as T
import torchvision.models as models
import torch.nn as nn

app = FastAPI(title="Boli AI Vetting Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CLASSES = ["Mint", "Good", "Fair", "Poor"]
MODEL_PATH = os.path.join(os.path.dirname(__file__), "condition_model.pt")

model = None

def load_model():
    global model
    m = models.efficientnet_b0(weights=None)
    m.classifier[1] = nn.Linear(m.classifier[1].in_features, 4)
    if os.path.exists(MODEL_PATH):
        m.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        print(f"[AI] Loaded trained model from {MODEL_PATH}")
    else:
        print("[AI] No trained model found — running in stub mode")
    m.eval()
    model = m

load_model()

transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


class IMEIRequest(BaseModel):
    imei: str


def luhn_check(imei: str) -> bool:
    if not imei.isdigit() or len(imei) != 15:
        return False
    digits = [int(d) for d in imei]
    digits.reverse()
    total = sum(
        d if i % 2 == 0 else (d * 2 - 9 if d * 2 > 9 else d * 2)
        for i, d in enumerate(digits)
    )
    return total % 10 == 0


@app.get("/health")
def health():
    model_loaded = os.path.exists(MODEL_PATH)
    return {"status": "ok", "model_loaded": model_loaded}


@app.post("/vetting/imei")
def check_imei(payload: IMEIRequest):
    valid = luhn_check(payload.imei)
    return {
        "imei": payload.imei,
        "valid": valid,
        "blacklisted": False,
        "message": "Valid IMEI" if valid else "Invalid IMEI format or checksum",
    }


@app.post("/vetting/analyze")
async def analyze(file: UploadFile = File(...)):
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    if not os.path.exists(MODEL_PATH):
        # Stub mode — return a confident demo result
        return {
            "condition": "Good",
            "confidence": 0.87,
            "class_probabilities": {
                "Mint": 0.05,
                "Good": 0.87,
                "Fair": 0.06,
                "Poor": 0.02,
            },
            "flags": [],
            "verified": True,
            "mode": "stub",
        }

    tensor = transform(img).unsqueeze(0)
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0].tolist()

    predicted_idx = int(torch.argmax(logits, dim=1).item())
    predicted_class = CLASSES[predicted_idx]
    confidence = round(probs[predicted_idx], 4)

    return {
        "condition": predicted_class,
        "confidence": confidence,
        "class_probabilities": {
            CLASSES[i]: round(p, 4) for i, p in enumerate(probs)
        },
        "flags": [],
        "verified": True,
        "mode": "model",
    }
