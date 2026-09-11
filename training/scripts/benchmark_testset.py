import json
import csv
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from PIL import Image


# ============================================================
# CRAI VISION BENCHMARK V1
# V2 CROSS-DATASET TEST EVALUATION
# ============================================================

print("=" * 70)
print("CRAI VISION BENCHMARK - MOBILEV3-SMALL V2")
print("PlantDoc Cross-Dataset Evaluation")
print("=" * 70)


# ============================================================
# PATHS
# ============================================================

ROOT = Path(__file__).resolve().parents[2]

DATASET_DIR = (
    ROOT
    / "backend"
    / "data"
    / "datasets"
    / "plantdoc"
    / "test"
)

MODEL_PATH = (
    ROOT
    / "backend"
    / "models"
    / "crai_disease_mobilenetv3_v2.pth"
)

CLASSES_PATH = (
    ROOT
    / "backend"
    / "models"
    / "classes_v2.json"
)

RESULTS_DIR = (
    ROOT
    / "training"
    / "results"
    / "baseline_v2"
)

RESULTS_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print()
print(f"Device : {DEVICE}")
print(f"Dataset: {DATASET_DIR}")
print(f"Model  : {MODEL_PATH}")
print()


# ============================================================
# LOAD CLASSES
# ============================================================

with CLASSES_PATH.open(
    "r",
    encoding="utf-8"
) as f:
    CLASSES = json.load(f)

CLASS_TO_INDEX = {
    name: i
    for i, name in enumerate(CLASSES)
}


# ============================================================
# PLANTDOC -> CRAI MAPPING
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
# Same inference preprocessing as V2
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

print("=" * 70)
print("COLLECTING PLANTDOC TEST DATA")
print("=" * 70)

for folder_name, class_name in PLANTDOC_MAP.items():

    folder = DATASET_DIR / folder_name

    if not folder.exists():

        print(
            f"WARNING: Missing folder: {folder_name}"
        )

        continue

    files = []

    for path in folder.rglob("*"):

        if (
            path.is_file()
            and path.suffix.lower()
            in {
                ".jpg",
                ".jpeg",
                ".png",
                ".bmp",
                ".webp",
            }
        ):
            files.append(path)

    for path in files:

        samples.append(
            (
                path,
                class_name,
            )
        )

    print(
        f"{class_name:<32}"
        f"{len(files):>5} images"
    )


print()
print(
    f"Total test images: {len(samples)}"
)
print()


if len(samples) == 0:

    raise RuntimeError(
        "No PlantDoc test images were found."
    )


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

print("=" * 70)
print("LOADING FROZEN V2 MODEL")
print("=" * 70)

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE,
    weights_only=False
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

if isinstance(checkpoint, dict):

    if "model_state_dict" in checkpoint:

        state_dict = (
            checkpoint["model_state_dict"]
        )

    elif "state_dict" in checkpoint:

        state_dict = checkpoint["state_dict"]

    else:

        state_dict = checkpoint

else:

    state_dict = checkpoint


cleaned_state_dict = {}

for key, value in state_dict.items():

    if key.startswith("module."):

        key = key[7:]

    cleaned_state_dict[key] = value


model.load_state_dict(
    cleaned_state_dict,
    strict=True
)

model = model.to(DEVICE)

model.eval()

print("Model loaded successfully.")
print()


# ============================================================
# CONFUSION MATRIX
# ============================================================

num_classes = len(CLASSES)

confusion = [
    [0 for _ in range(num_classes)]
    for _ in range(num_classes)
]


# ============================================================
# PREDICTION STORAGE
# ============================================================

all_predictions = []
all_labels = []


# ============================================================
# EVALUATION
# ============================================================

print("=" * 70)
print("RUNNING TEST EVALUATION")
print("=" * 70)

correct = 0
total = 0


with torch.inference_mode():

    for images, labels in loader:

        images = images.to(DEVICE)
        labels = labels.to(DEVICE)

        outputs = model(images)

        predictions = torch.argmax(
            outputs,
            dim=1
        )

        for actual, predicted in zip(
            labels.cpu().tolist(),
            predictions.cpu().tolist()
        ):

            confusion[actual][predicted] += 1

            all_labels.append(actual)
            all_predictions.append(predicted)

            total += 1

            if actual == predicted:

                correct += 1


# ============================================================
# BASIC METRICS
# ============================================================

accuracy = (
    correct / total
    if total > 0
    else 0.0
)


# ============================================================
# PER CLASS METRICS
# ============================================================

per_class = []

for index, class_name in enumerate(CLASSES):

    true_positive = confusion[index][index]

    false_positive = sum(
        confusion[row][index]
        for row in range(num_classes)
        if row != index
    )

    false_negative = sum(
        confusion[index][column]
        for column in range(num_classes)
        if column != index
    )

    support = sum(
        confusion[index]
    )

    if (
        true_positive
        + false_positive
        > 0
    ):

        precision = (
            true_positive
            / (
                true_positive
                + false_positive
            )
        )

    else:

        precision = 0.0


    if (
        true_positive
        + false_negative
        > 0
    ):

        recall = (
            true_positive
            / (
                true_positive
                + false_negative
            )
        )

    else:

        recall = 0.0


    if (
        precision + recall
        > 0
    ):

        f1 = (
            2
            * precision
            * recall
            / (
                precision
                + recall
            )
        )

    else:

        f1 = 0.0


    per_class.append({

        "class": class_name,

        "precision": round(
            precision,
            6
        ),

        "recall": round(
            recall,
            6
        ),

        "f1": round(
            f1,
            6
        ),

        "support": support,

    })


# ============================================================
# MACRO METRICS
# ============================================================

macro_precision = (
    sum(
        item["precision"]
        for item in per_class
    )
    / num_classes
)

macro_recall = (
    sum(
        item["recall"]
        for item in per_class
    )
    / num_classes
)

macro_f1 = (
    sum(
        item["f1"]
        for item in per_class
    )
    / num_classes
)


# ============================================================
# PRINT RESULTS
# ============================================================

print()
print("=" * 70)
print("CRAI V2 TEST RESULTS")
print("=" * 70)

print(
    f"Images evaluated : {total}"
)

print(
    f"Correct          : {correct}"
)

print(
    f"Accuracy         : {accuracy * 100:.2f}%"
)

print(
    f"Macro Precision  : {macro_precision * 100:.2f}%"
)

print(
    f"Macro Recall     : {macro_recall * 100:.2f}%"
)

print(
    f"Macro F1         : {macro_f1 * 100:.2f}%"
)

print()


# ============================================================
# PER CLASS OUTPUT
# ============================================================

print("=" * 70)
print("PER-CLASS METRICS")
print("=" * 70)

for item in per_class:

    print(
        f"{item['class']:<32}"
        f"P={item['precision'] * 100:>7.2f}% "
        f"R={item['recall'] * 100:>7.2f}% "
        f"F1={item['f1'] * 100:>7.2f}% "
        f"N={item['support']}"
    )


# ============================================================
# SAVE TEST METRICS
# ============================================================

metrics = {

    "benchmark_version":
        "CRAI_VISION_BENCHMARK_V1",

    "model":
        "MobileNetV3-Small V2",

    "evaluation":
        "PlantDoc cross-dataset test",

    "device":
        str(DEVICE),

    "classes":
        num_classes,

    "images_evaluated":
        total,

    "correct":
        correct,

    "accuracy":
        round(
            accuracy,
            6
        ),

    "accuracy_percent":
        round(
            accuracy * 100,
            4
        ),

    "macro_precision":
        round(
            macro_precision,
            6
        ),

    "macro_precision_percent":
        round(
            macro_precision * 100,
            4
        ),

    "macro_recall":
        round(
            macro_recall,
            6
        ),

    "macro_recall_percent":
        round(
            macro_recall * 100,
            4
        ),

    "macro_f1":
        round(
            macro_f1,
            6
        ),

    "macro_f1_percent":
        round(
            macro_f1 * 100,
            4
        ),

    "per_class":
        per_class,

    "confusion_matrix":
        confusion,

}


metrics_path = (
    RESULTS_DIR
    / "test_metrics.json"
)

with metrics_path.open(
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        metrics,
        f,
        indent=2
    )


# ============================================================
# SAVE PER-CLASS CSV
# ============================================================

csv_path = (
    RESULTS_DIR
    / "per_class_metrics.csv"
)

with csv_path.open(
    "w",
    newline="",
    encoding="utf-8"
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=[
            "class",
            "precision",
            "recall",
            "f1",
            "support",
        ]
    )

    writer.writeheader()

    writer.writerows(
        per_class
    )


# ============================================================
# SAVE CONFUSION MATRIX CSV
# ============================================================

confusion_path = (
    RESULTS_DIR
    / "confusion_matrix.csv"
)

with confusion_path.open(
    "w",
    newline="",
    encoding="utf-8"
) as f:

    writer = csv.writer(f)

    writer.writerow(
        ["actual/predicted"]
        + CLASSES
    )

    for index, class_name in enumerate(
        CLASSES
    ):

        writer.writerow(
            [class_name]
            + confusion[index]
        )


# ============================================================
# FINAL
# ============================================================

print()
print("=" * 70)
print("BENCHMARK FILES SAVED")
print("=" * 70)

print(metrics_path)
print(csv_path)
print(confusion_path)

print()
print("=" * 70)
print("STATUS: V2 TEST BENCHMARK COMPLETE")
print("=" * 70)
