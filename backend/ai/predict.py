import sys
import json
from pathlib import Path

import torch
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image


# ============================================================
# CRAI V2 - PLANT DISEASE PREDICTOR
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "crai_disease_mobilenetv3_v2.pth"
CLASSES_PATH = BASE_DIR / "models" / "classes_v2.json"


# ------------------------------------------------------------
# Device
# ------------------------------------------------------------

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ------------------------------------------------------------
# Load classes
# ------------------------------------------------------------

with open(CLASSES_PATH, "r", encoding="utf-8") as f:
    CLASSES = json.load(f)


# ------------------------------------------------------------
# Create model
# ------------------------------------------------------------

model = models.mobilenet_v3_small(weights=None)

model.classifier[3] = torch.nn.Linear(
    model.classifier[3].in_features,
    len(CLASSES)
)


# ------------------------------------------------------------
# Load trained V2 weights
# ------------------------------------------------------------

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE
)

if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    model.load_state_dict(checkpoint["model_state_dict"])
else:
    model.load_state_dict(checkpoint)


model.to(DEVICE)
model.eval()


# ------------------------------------------------------------
# Image preprocessing
# ------------------------------------------------------------

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ------------------------------------------------------------
# Prediction function
# ------------------------------------------------------------

def predict_image(image_path, top_k=3):

    image = Image.open(image_path).convert("RGB")

    tensor = transform(image)
    tensor = tensor.unsqueeze(0)
    tensor = tensor.to(DEVICE)

    with torch.no_grad():

        outputs = model(tensor)

        probabilities = F.softmax(outputs, dim=1)

        values, indices = torch.topk(
            probabilities,
            min(top_k, len(CLASSES)),
            dim=1
        )

    predictions = []

    for probability, index in zip(
        values[0],
        indices[0]
    ):

        predictions.append({
            "class": CLASSES[index.item()],
            "confidence": round(
                probability.item() * 100,
                2
            )
        })

    return predictions


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

if __name__ == "__main__":

    if len(sys.argv) < 2:

        print(
            "Usage: python ai/predict.py <image_path>"
        )

        sys.exit(1)


    image_path = Path(sys.argv[1])


    if not image_path.exists():

        print(
            f"ERROR: Image not found: {image_path}"
        )

        sys.exit(1)


    predictions = predict_image(image_path)


    print()
    print("=" * 60)
    print("CRAI V2 DISEASE PREDICTION")
    print("=" * 60)

    print(
        f"Prediction: {predictions[0]['class']}"
    )

    print(
        f"Confidence: {predictions[0]['confidence']:.2f}%"
    )

    print()
    print("Top predictions:")

    for prediction in predictions:

        print(
            f"  {prediction['class']}: "
            f"{prediction['confidence']:.2f}%"
        )

    print("=" * 60)