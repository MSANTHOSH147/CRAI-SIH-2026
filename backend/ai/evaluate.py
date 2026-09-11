import os
import json
import torch
from PIL import Image
from torchvision import transforms, models
import torch.nn as nn
from collections import defaultdict


# ============================================================
# CRAI - PlantDoc Evaluation
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_PATH = os.path.join(
    BASE_DIR, "models", "crai_disease_mobilenetv3.pth"
)

CLASSES_PATH = os.path.join(
    BASE_DIR, "models", "classes.json"
)

PLANTDOC_TEST = os.path.join(
    BASE_DIR, "data", "datasets", "plantdoc", "test"
)

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# Load model classes
# ============================================================

with open(CLASSES_PATH, "r", encoding="utf-8") as f:
    model_classes = json.load(f)


# ============================================================
# Map PlantDoc class names → model classes
# ============================================================

CLASS_MAP = {
    "Potato leaf early blight": "Potato_Early_Blight",
    "Potato leaf late blight": "Potato_Late_Blight",

    "Tomato Early blight leaf": "Tomato_Early_Blight",
    "Tomato leaf bacterial spot": "Tomato_Bacterial_Spot",
    "Tomato leaf late blight": "Tomato_Late_Blight",
}


# ============================================================
# Load model
# ============================================================

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE
)

model = models.mobilenet_v3_small(
    weights=None
)

input_features = model.classifier[3].in_features

model.classifier[3] = nn.Linear(
    input_features,
    len(model_classes)
)

model.load_state_dict(
    checkpoint["model_state_dict"]
)

model = model.to(DEVICE)
model.eval()


# ============================================================
# Image preprocessing
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
# Evaluation
# ============================================================

correct = 0
total = 0

class_stats = defaultdict(
    lambda: {"correct": 0, "total": 0}
)

confusion = defaultdict(
    lambda: defaultdict(int)
)

skipped = 0


print("=" * 65)
print("CRAI - PlantDoc Evaluation")
print("=" * 65)

print(f"Device: {DEVICE}")
print(f"Dataset: {PLANTDOC_TEST}")
print()

print("Evaluating compatible PlantDoc classes...")
print()


for plantdoc_class, model_class in CLASS_MAP.items():

    class_path = os.path.join(
        PLANTDOC_TEST,
        plantdoc_class
    )

    if not os.path.isdir(class_path):
        print(
            f"WARNING: Missing class: "
            f"{plantdoc_class}"
        )
        continue

    images = [
        x for x in os.listdir(class_path)
        if x.lower().endswith(
            (".jpg", ".jpeg", ".png", ".bmp", ".webp")
        )
    ]

    print(
        f"{plantdoc_class}: "
        f"{len(images)} images"
    )

    for filename in images:

        image_path = os.path.join(
            class_path,
            filename
        )

        try:

            image = Image.open(
                image_path
            ).convert("RGB")

            tensor = transform(
                image
            ).unsqueeze(0).to(DEVICE)

            with torch.no_grad():

                output = model(tensor)

                probabilities = torch.softmax(
                    output,
                    dim=1
                )

                prediction_index = torch.argmax(
                    probabilities,
                    dim=1
                ).item()

            predicted_class = model_classes[
                prediction_index
            ]

            total += 1

            class_stats[model_class]["total"] += 1

            confusion[model_class][
                predicted_class
            ] += 1

            if predicted_class == model_class:

                correct += 1

                class_stats[model_class][
                    "correct"
                ] += 1

        except Exception as e:

            skipped += 1

            print(
                f"Skipped: {filename}"
            )


# ============================================================
# Results
# ============================================================

print()
print("=" * 65)
print("PLANTDOC RESULTS")
print("=" * 65)

if total > 0:

    accuracy = (
        correct / total
    ) * 100

    print(
        f"Overall Accuracy: "
        f"{accuracy:.2f}%"
    )

else:

    print("No compatible images found.")


print()
print("Per-class accuracy:")
print("-" * 65)

for class_name, stats in class_stats.items():

    if stats["total"] > 0:

        accuracy = (
            stats["correct"] /
            stats["total"]
        ) * 100

        print(
            f"{class_name}: "
            f"{accuracy:.2f}% "
            f"({stats['correct']}/"
            f"{stats['total']})"
        )


print()
print("Confusion Matrix:")
print("-" * 65)

for actual_class in confusion:

    print()
    print(
        f"Actual: {actual_class}"
    )

    for predicted_class, count in sorted(
        confusion[actual_class].items()
    ):

        print(
            f"  → {predicted_class}: "
            f"{count}"
        )


print()
print("-" * 65)
print(
    f"Images evaluated: {total}"
)
print(
    f"Images skipped: {skipped}"
)
print("-" * 65)

print()
print("Evaluation complete.")