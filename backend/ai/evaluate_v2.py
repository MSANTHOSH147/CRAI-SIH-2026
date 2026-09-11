import json
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from PIL import Image


# ============================================================
# CRAI V2 - PLANTDOC EVALUATION
# ============================================================

print("=" * 65)
print("CRAI V2 - PlantDoc Evaluation")
print("=" * 65)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATASET_DIR = (
    BASE_DIR
    / "data"
    / "datasets"
    / "plantdoc"
    / "test"
)

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "crai_disease_mobilenetv3_v2.pth"
)

CLASSES_PATH = (
    BASE_DIR
    / "models"
    / "classes_v2.json"
)


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print(f"Device: {DEVICE}")
print(f"Dataset: {DATASET_DIR}")
print(f"Model:   {MODEL_PATH}")
print()


# ============================================================
# LOAD CLASSES
# ============================================================

with open(
    CLASSES_PATH,
    "r",
    encoding="utf-8"
) as f:

    CLASSES = json.load(f)


CLASS_TO_INDEX = {
    name: i
    for i, name in enumerate(CLASSES)
}


# ============================================================
# PLANTDOC → CRAI CLASS MAPPING
# ============================================================

PLANTDOC_MAP = {

    "Potato leaf early blight":
        "Potato_Early_Blight",

    "Potato leaf late blight":
        "Potato_Late_Blight",

    "Tomato Early blight leaf":
        "Tomato_Early_Blight",

    "Tomato leaf bacterial spot":
        "Tomato_Bacterial_Spot",

    "Tomato leaf late blight":
        "Tomato_Late_Blight",

    "Tomato leaf mosaic virus":
        "Tomato_Mosaic_Virus",

    "Tomato leaf yellow virus":
        "Tomato_Yellow_Virus",

    "Tomato mold leaf":
        "Tomato_Leaf_Mold",

    "Tomato Septoria leaf spot":
        "Tomato_Septoria_Leaf_Spot",
}


# ============================================================
# TRANSFORM
# ============================================================

transform = transforms.Compose([

    transforms.Resize(
        (224, 224)
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        [0.485, 0.456, 0.406],
        [0.229, 0.224, 0.225]
    ),
])


# ============================================================
# COLLECT TEST IMAGES
# ============================================================

samples = []

print("=" * 65)
print("LOADING PLANTDOC TEST DATA")
print("=" * 65)

for folder_name, class_name in PLANTDOC_MAP.items():

    folder = DATASET_DIR / folder_name

    if not folder.exists():

        print(
            f"WARNING: Missing {folder_name}"
        )

        continue

    files = []

    for p in folder.rglob("*"):

        if p.is_file() and p.suffix.lower() in {
            ".jpg",
            ".jpeg",
            ".png",
            ".bmp",
            ".webp"
        }:

            files.append(p)

    for p in files:

        samples.append(
            (
                p,
                class_name
            )
        )

    print(
        f"{folder_name:<35}"
        f"{len(files):>4} images"
    )


print()
print(
    f"Total test images: {len(samples)}"
)
print()


# ============================================================
# DATASET
# ============================================================

class PlantDocDataset(Dataset):

    def __init__(
        self,
        samples,
        transform
    ):

        self.samples = samples
        self.transform = transform


    def __len__(self):

        return len(self.samples)


    def __getitem__(self, index):

        path, class_name = self.samples[index]

        image = Image.open(
            path
        ).convert("RGB")

        image = self.transform(image)

        label = CLASS_TO_INDEX[
            class_name
        ]

        return image, label


dataset = PlantDocDataset(
    samples,
    transform
)


loader = DataLoader(
    dataset,
    batch_size=32,
    shuffle=False,
    num_workers=0
)


# ============================================================
# LOAD MODEL
# ============================================================

print("=" * 65)
print("LOADING CRAI V2 MODEL")
print("=" * 65)


checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE
)


model = models.mobilenet_v3_small(
    weights=None
)


input_features = (
    model.classifier[3].in_features
)


model.classifier[3] = nn.Linear(
    input_features,
    len(CLASSES)
)


model.load_state_dict(
    checkpoint["model_state_dict"]
)


model = model.to(DEVICE)

model.eval()


print(
    f"Classes: {len(CLASSES)}"
)

print(
    "Model loaded successfully."
)

print()


# ============================================================
# EVALUATION
# ============================================================

correct = 0
total = 0

per_class_correct = {
    name: 0
    for name in CLASSES
}

per_class_total = {
    name: 0
    for name in CLASSES
}


# confusion matrix

confusion = {

    actual: {
        predicted: 0
        for predicted in CLASSES
    }

    for actual in CLASSES
}


print("=" * 65)
print("RUNNING PLANTDOC EVALUATION")
print("=" * 65)


with torch.no_grad():

    for images, labels in loader:

        images = images.to(DEVICE)
        labels = labels.to(DEVICE)

        outputs = model(images)

        predictions = torch.argmax(
            outputs,
            dim=1
        )


        for actual_idx, predicted_idx in zip(
            labels,
            predictions
        ):

            actual_name = CLASSES[
                actual_idx.item()
            ]

            predicted_name = CLASSES[
                predicted_idx.item()
            ]


            total += 1

            per_class_total[
                actual_name
            ] += 1


            confusion[
                actual_name
            ][
                predicted_name
            ] += 1


            if actual_idx == predicted_idx:

                correct += 1

                per_class_correct[
                    actual_name
                ] += 1


# ============================================================
# RESULTS
# ============================================================

accuracy = (
    correct / total * 100
    if total > 0
    else 0
)


print()
print("=" * 65)
print("CRAI V2 - PLANTDOC RESULTS")
print("=" * 65)

print(
    f"Overall Accuracy: "
    f"{accuracy:.2f}%"
)

print()


# ============================================================
# PER CLASS
# ============================================================

print("Per-class accuracy:")
print("-" * 65)

evaluated_classes = []

for class_name in CLASSES:

    class_total = (
        per_class_total[class_name]
    )

    if class_total == 0:
        continue

    evaluated_classes.append(
        class_name
    )

    class_correct = (
        per_class_correct[class_name]
    )

    class_accuracy = (
        class_correct
        / class_total
        * 100
    )

    print(
        f"{class_name:<30}"
        f"{class_accuracy:>7.2f}% "
        f"({class_correct}/{class_total})"
    )


# ============================================================
# CONFUSION MATRIX
# ============================================================

print()
print("Confusion Matrix:")
print("-" * 65)


for actual_name in evaluated_classes:

    print()
    print(
        f"Actual: {actual_name}"
    )

    predictions = confusion[
        actual_name
    ]

    non_zero = [
        (name, count)
        for name, count in predictions.items()
        if count > 0
    ]

    non_zero.sort(
        key=lambda x: x[1],
        reverse=True
    )

    for predicted_name, count in non_zero:

        print(
            f"  → {predicted_name}: "
            f"{count}"
        )


# ============================================================
# SUMMARY
# ============================================================

print()
print("-" * 65)

print(
    f"Images evaluated: {total}"
)

print(
    f"Images skipped:   {len(samples) - total}"
)

print("-" * 65)

print()
print("Evaluation complete.")
print()


# ============================================================
# COMPARISON
# ============================================================

print("=" * 65)
print("V1 vs V2")
print("=" * 65)

print(
    "V1 PlantDoc accuracy: 27.27%"
)

print(
    f"V2 PlantDoc accuracy: {accuracy:.2f}%"
)

difference = accuracy - 27.27

print(
    f"Difference: {difference:+.2f} percentage points"
)

print("=" * 65)