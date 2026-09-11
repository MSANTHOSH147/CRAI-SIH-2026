import json
import csv
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np


# ============================================================
# CRAI VISION BENCHMARK V1
# V2 ROBUSTNESS EVALUATION
# ============================================================

ROOT = Path(__file__).resolve().parents[2]

DATASET_DIR = (
    ROOT / "backend" / "data" / "datasets"
    / "plantdoc" / "test"
)

MODEL_PATH = (
    ROOT / "backend" / "models"
    / "crai_disease_mobilenetv3_v2.pth"
)

CLASSES_PATH = (
    ROOT / "backend" / "models"
    / "classes_v2.json"
)

RESULTS_DIR = (
    ROOT / "training" / "results"
    / "baseline_v2"
)

RESULTS_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# SETTINGS
# ============================================================

IMAGE_SIZE = 224
BATCH_SIZE = 32

torch.manual_seed(42)
np.random.seed(42)


# ============================================================
# CLASSES
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
# PLANTDOC MAPPING
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
# COLLECT IMAGES
# ============================================================

samples = []

for folder_name, class_name in PLANTDOC_MAP.items():

    folder = DATASET_DIR / folder_name

    if not folder.exists():
        continue

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

            samples.append(
                (path, class_name)
            )


print("=" * 70)
print("CRAI V2 ROBUSTNESS BENCHMARK")
print("=" * 70)

print(
    f"Test images: {len(samples)}"
)


# ============================================================
# MODEL
# ============================================================

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available()
    else "cpu"
)

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE,
    weights_only=False
)

model = models.mobilenet_v3_small(
    weights=None
)

model.classifier[3] = nn.Linear(
    model.classifier[3].in_features,
    len(CLASSES)
)

state_dict = (
    checkpoint["model_state_dict"]
    if isinstance(checkpoint, dict)
    and "model_state_dict" in checkpoint
    else checkpoint
)

model.load_state_dict(
    state_dict,
    strict=True
)

model = model.to(DEVICE)
model.eval()


# ============================================================
# IMAGE TRANSFORM
# ============================================================

normalize = transforms.Normalize(
    [0.485, 0.456, 0.406],
    [0.229, 0.224, 0.225]
)


def to_tensor(image):

    image = image.resize(
        (IMAGE_SIZE, IMAGE_SIZE)
    )

    tensor = transforms.ToTensor()(
        image
    )

    return normalize(tensor)


# ============================================================
# CORRUPTIONS
# ============================================================

def original(image):

    return image


def brightness(image):

    return ImageEnhance.Brightness(
        image
    ).enhance(0.55)


def contrast(image):

    return ImageEnhance.Contrast(
        image
    ).enhance(0.55)


def blur(image):

    return image.filter(
        ImageFilter.GaussianBlur(
            radius=2.5
        )
    )


def noise(image):

    array = np.asarray(
        image
    ).astype(np.float32)

    noise_array = np.random.normal(
        0,
        25,
        array.shape
    )

    array = np.clip(
        array + noise_array,
        0,
        255
    ).astype(np.uint8)

    return Image.fromarray(
        array
    )


def low_resolution(image):

    small = image.resize(
        (56, 56)
    )

    return small.resize(
        image.size
    )


def occlusion(image):

    image = image.copy()

    width, height = image.size

    block_w = max(
        1,
        int(width * 0.25)
    )

    block_h = max(
        1,
        int(height * 0.25)
    )

    left = (
        width - block_w
    ) // 2

    top = (
        height - block_h
    ) // 2

    pixels = image.load()

    for x in range(
        left,
        left + block_w
    ):

        for y in range(
            top,
            top + block_h
        ):

            pixels[x, y] = (
                128,
                128,
                128
            )

    return image


CONDITIONS = {

    "original":
        original,

    "brightness_reduced":
        brightness,

    "contrast_reduced":
        contrast,

    "blur":
        blur,

    "noise":
        noise,

    "low_resolution":
        low_resolution,

    "partial_occlusion":
        occlusion,
}


# ============================================================
# EVALUATION
# ============================================================

results = []


for condition_name, corruption in CONDITIONS.items():

    correct = 0
    total = 0

    confusion = [
        [0 for _ in CLASSES]
        for _ in CLASSES
    ]

    print()
    print(
        f"Testing: {condition_name}"
    )

    with torch.inference_mode():

        for path, class_name in samples:

            image = Image.open(
                path
            ).convert("RGB")

            image = corruption(
                image
            )

            tensor = to_tensor(
                image
            ).unsqueeze(0)

            tensor = tensor.to(
                DEVICE
            )

            output = model(
                tensor
            )

            prediction = torch.argmax(
                output,
                dim=1
            ).item()

            actual = CLASS_TO_INDEX[
                class_name
            ]

            confusion[
                actual
            ][
                prediction
            ] += 1

            total += 1

            if prediction == actual:

                correct += 1


    accuracy = (
        correct / total * 100
        if total
        else 0
    )

    results.append({

        "condition":
            condition_name,

        "images":
            total,

        "correct":
            correct,

        "accuracy_percent":
            round(
                accuracy,
                4
            ),

    })

    print(
        f"Accuracy: {accuracy:.2f}%"
    )


# ============================================================
# SAVE RESULTS
# ============================================================

output_json = (
    RESULTS_DIR
    / "robustness.json"
)

with output_json.open(
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        {
            "benchmark_version":
                "CRAI_VISION_BENCHMARK_V1",

            "model":
                "MobileNetV3-Small V2",

            "test_dataset":
                "PlantDoc",

            "images":
                len(samples),

            "conditions":
                results,

        },
        f,
        indent=2
    )


output_csv = (
    RESULTS_DIR
    / "robustness.csv"
)

with output_csv.open(
    "w",
    newline="",
    encoding="utf-8"
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=[
            "condition",
            "images",
            "correct",
            "accuracy_percent",
        ]
    )

    writer.writeheader()

    writer.writerows(
        results
    )


# ============================================================
# FINAL
# ============================================================

print()
print("=" * 70)
print("ROBUSTNESS RESULTS")
print("=" * 70)

for item in results:

    print(
        f"{item['condition']:<25}"
        f"{item['accuracy_percent']:>8.2f}%"
    )

print()
print("Saved:")
print(output_json)
print(output_csv)

print()
print(
    "STATUS: V2 ROBUSTNESS BENCHMARK COMPLETE"
)
