import os
import json
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from pathlib import Path
from collections import defaultdict

# ============================================================
# CRAAI V3 - PLANTDOC EVALUATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "crai_disease_mobilenetv3_v3.pth"
CLASSES_PATH = BASE_DIR / "models" / "classes_v3.json"
TEST_DIR = BASE_DIR / "data" / "datasets" / "plantdoc" / "test"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("=" * 65)
print("CRAAI V3 - PlantDoc Evaluation")
print("=" * 65)

print(f"Device: {DEVICE}")
print(f"Dataset: {TEST_DIR}")
print(f"Model:   {MODEL_PATH}")

# ============================================================
# CHECK FILES
# ============================================================

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

if not CLASSES_PATH.exists():
    raise FileNotFoundError(f"Classes file not found: {CLASSES_PATH}")

if not TEST_DIR.exists():
    raise FileNotFoundError(f"Test dataset not found: {TEST_DIR}")

# ============================================================
# LOAD CLASSES
# ============================================================

with open(CLASSES_PATH, "r", encoding="utf-8") as f:
    classes = json.load(f)

print("\n" + "=" * 65)
print("CLASSES")
print("=" * 65)

for i, cls in enumerate(classes):
    print(f"{i:2d}: {cls}")

# ============================================================
# CLASS NAME MAPPING
# ============================================================

plantdoc_to_model = {
    "Potato leaf early blight": "Potato_Early_Blight",
    "Potato leaf late blight": "Potato_Late_Blight",
    "Potato leaf": "Potato_Healthy",

    "Tomato Early blight leaf": "Tomato_Early_Blight",
    "Tomato leaf bacterial spot": "Tomato_Bacterial_Spot",
    "Tomato leaf late blight": "Tomato_Late_Blight",
    "Tomato leaf mosaic virus": "Tomato_Mosaic_Virus",
    "Tomato leaf yellow virus": "Tomato_Yellow_Virus",
    "Tomato mold leaf": "Tomato_Leaf_Mold",
    "Tomato Septoria leaf spot": "Tomato_Septoria_Leaf_Spot",

    "Tomato leaf": "Tomato_Healthy",
}

# ============================================================
# TRANSFORM
# ============================================================

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ============================================================
# LOAD MODEL
# ============================================================

print("\n" + "=" * 65)
print("LOADING CRAAI V3 MODEL")
print("=" * 65)

model = models.mobilenet_v3_small(
    weights=None
)

model.classifier[3] = nn.Linear(
    model.classifier[3].in_features,
    len(classes)
)

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE
)

# Support both state_dict and direct state dict formats
if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    model.load_state_dict(checkpoint["model_state_dict"])
else:
    model.load_state_dict(checkpoint)

model = model.to(DEVICE)
model.eval()

print(f"Classes: {len(classes)}")
print("Model loaded successfully.")

# ============================================================
# COLLECT TEST IMAGES
# ============================================================

print("\n" + "=" * 65)
print("LOADING PLANTDOC TEST DATA")
print("=" * 65)

samples = []

for folder in sorted(TEST_DIR.iterdir()):

    if not folder.is_dir():
        continue

    plantdoc_class = folder.name

    if plantdoc_class not in plantdoc_to_model:
        print(f"Skipping unknown class: {plantdoc_class}")
        continue

    expected_class = plantdoc_to_model[plantdoc_class]

    image_files = []

    for ext in ["*.jpg", "*.JPG", "*.jpeg", "*.JPEG", "*.png", "*.PNG"]:
        image_files.extend(folder.glob(ext))

    print(
        f"{plantdoc_class:<35} "
        f"{len(image_files):>3} images"
    )

    for image_path in image_files:

        samples.append(
            (
                image_path,
                plantdoc_class,
                expected_class
            )
        )

print(f"\nTotal test images: {len(samples)}")

# ============================================================
# EVALUATION
# ============================================================

print("\n" + "=" * 65)
print("RUNNING PLANTDOC EVALUATION")
print("=" * 65)

correct = 0
evaluated = 0
skipped = 0

class_total = defaultdict(int)
class_correct = defaultdict(int)

confusion = defaultdict(lambda: defaultdict(int))

with torch.no_grad():

    for image_path, plantdoc_class, expected_class in samples:

        try:

            image = Image.open(image_path).convert("RGB")

            tensor = transform(image).unsqueeze(0).to(DEVICE)

            output = model(tensor)

            probabilities = torch.softmax(output, dim=1)

            prediction_index = torch.argmax(
                probabilities,
                dim=1
            ).item()

            predicted_class = classes[prediction_index]

            evaluated += 1

            class_total[expected_class] += 1

            confusion[expected_class][predicted_class] += 1

            if predicted_class == expected_class:

                correct += 1
                class_correct[expected_class] += 1

        except Exception as e:

            skipped += 1

            print(
                f"Skipped: {image_path.name}"
            )

            print(
                f"Reason: {e}"
            )

# ============================================================
# RESULTS
# ============================================================

accuracy = (
    correct / evaluated * 100
    if evaluated > 0
    else 0
)

print("\n" + "=" * 65)
print("CRAAI V3 - PLANTDOC RESULTS")
print("=" * 65)

print(
    f"Overall Accuracy: {accuracy:.2f}%"
)

# ============================================================
# PER CLASS
# ============================================================

print("\nPer-class accuracy:")
print("-" * 65)

for cls in classes:

    total = class_total[cls]
    good = class_correct[cls]

    if total > 0:
        acc = good / total * 100

        print(
            f"{cls:<32} "
            f"{acc:>6.2f}% "
            f"({good}/{total})"
        )

# ============================================================
# CONFUSION MATRIX
# ============================================================

print("\nConfusion Matrix:")
print("-" * 65)

for actual_class in classes:

    if class_total[actual_class] == 0:
        continue

    print(f"\nActual: {actual_class}")

    predictions = confusion[actual_class]

    sorted_predictions = sorted(
        predictions.items(),
        key=lambda x: x[1],
        reverse=True
    )

    for predicted_class, count in sorted_predictions:

        print(
            f"  → {predicted_class}: {count}"
        )

# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "-" * 65)
print(f"Images evaluated: {evaluated}")
print(f"Images skipped:   {skipped}")
print("-" * 65)

print("\nEvaluation complete.")

print("\n" + "=" * 65)
print("V1 vs V2 vs V3")
print("=" * 65)

print("V1 PlantDoc accuracy: 27.27%")
print("V2 PlantDoc accuracy: 49.35%")
print(f"V3 PlantDoc accuracy: {accuracy:.2f}%")

print("-" * 65)

print(
    f"V2 → V3 improvement: "
    f"{accuracy - 49.35:+.2f} percentage points"
)

print("=" * 65)