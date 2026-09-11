import json
import random
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from PIL import Image


# ============================================================
# CRAI V2 - PLANT DISEASE TRAINING
# ============================================================

print("=" * 60)
print("CRAI V2 - Plant Disease AI Training")
print("=" * 60)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

PLANTVILLAGE = BASE_DIR / "data" / "datasets" / "plantvillage"
PLANTDOC = BASE_DIR / "data" / "datasets" / "plantdoc" / "train"

MODEL_DIR = BASE_DIR / "models"

MODEL_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = MODEL_DIR / "crai_disease_mobilenetv3_v2.pth"
CLASSES_PATH = MODEL_DIR / "classes_v2.json"


# ============================================================
# SETTINGS
# ============================================================

IMAGE_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 5
LEARNING_RATE = 0.0005
WEIGHT_DECAY = 0.0001
VAL_RATIO = 0.20
SEED = 42
NUM_WORKERS = 0


# ============================================================
# RANDOM SEED
# ============================================================

random.seed(SEED)
torch.manual_seed(SEED)

if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print(f"Device: {DEVICE}")
print(f"PlantVillage: {PLANTVILLAGE}")
print(f"PlantDoc:     {PLANTDOC}")
print(f"Model output: {MODEL_DIR}")
print()


# ============================================================
# CRAI V2 CLASSES
# ============================================================

CLASSES = [
    "Potato_Early_Blight",
    "Potato_Late_Blight",
    "Potato_Healthy",

    "Tomato_Bacterial_Spot",
    "Tomato_Early_Blight",
    "Tomato_Late_Blight",
    "Tomato_Healthy",

    "Tomato_Mosaic_Virus",
    "Tomato_Yellow_Virus",
    "Tomato_Leaf_Mold",
    "Tomato_Septoria_Leaf_Spot",
]

CLASS_TO_INDEX = {
    name: i for i, name in enumerate(CLASSES)
}


# ============================================================
# PLANTVILLAGE FOLDER MAPPING
# ============================================================

PLANTVILLAGE_MAP = {

    "Potato_Early_Blight":
        "Potato_Early_Blight",

    "Potato_Late_Blight":
        "Potato_Late_Blight",

    "Potato_Healthy":
        "Potato_Healthy",

    "Tomato_Bacterial_Spot":
        "Tomato_Bacterial_Spot",

    "Tomato_Early_Blight":
        "Tomato_Early_Blight",

    "Tomato_Late_Blight":
        "Tomato_Late_Blight",

    "Tomato_Healthy":
        "Tomato_Healthy",
}


# ============================================================
# PLANTDOC FOLDER MAPPING
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
# IMAGE EXTENSIONS
# ============================================================

EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".JPG",
    ".JPEG",
    ".PNG",
    ".bmp",
    ".BMP",
    ".webp",
    ".WEBP",
}


# ============================================================
# COLLECT IMAGES
# ============================================================

def collect_images():

    samples = []

    print("=" * 60)
    print("LOADING PLANTVILLAGE")
    print("=" * 60)

    for folder_name, class_name in PLANTVILLAGE_MAP.items():

        folder = PLANTVILLAGE / folder_name

        if not folder.exists():
            print(f"WARNING: Missing {folder}")
            continue

        files = [
            p for p in folder.rglob("*")
            if p.is_file() and p.suffix in EXTENSIONS
        ]

        for file_path in files:
            samples.append(
                (file_path, class_name, "PlantVillage")
            )

        print(
            f"{folder_name:<28} "
            f"{len(files):>5} images"
        )

    print()
    print("=" * 60)
    print("LOADING PLANTDOC")
    print("=" * 60)

    for folder_name, class_name in PLANTDOC_MAP.items():

        folder = PLANTDOC / folder_name

        if not folder.exists():
            print(f"WARNING: Missing {folder}")
            continue

        files = [
            p for p in folder.rglob("*")
            if p.is_file() and p.suffix in EXTENSIONS
        ]

        for file_path in files:
            samples.append(
                (file_path, class_name, "PlantDoc")
            )

        print(
            f"{folder_name:<28} "
            f"{len(files):>5} images"
        )

    return samples


# ============================================================
# LOAD ALL DATA
# ============================================================

samples = collect_images()

print()
print("=" * 60)
print("DATASET SUMMARY")
print("=" * 60)

print(f"Combined images: {len(samples)}")
print(f"Classes:         {len(CLASSES)}")
print()


if len(samples) == 0:
    raise RuntimeError(
        "No training images were found."
    )


# ============================================================
# GROUP BY CLASS
# ============================================================

by_class = {
    class_name: []
    for class_name in CLASSES
}


for sample in samples:

    image_path, class_name, source = sample

    by_class[class_name].append(sample)


# ============================================================
# SHOW CLASS COUNTS
# ============================================================

print("Class distribution:")

for class_name in CLASSES:

    print(
        f"{class_name:<30}"
        f"{len(by_class[class_name]):>5}"
    )

print()


# ============================================================
# STRATIFIED TRAIN / VALIDATION SPLIT
# ============================================================

train_samples = []
val_samples = []

print("=" * 60)
print("CREATING TRAIN / VALIDATION SPLIT")
print("=" * 60)

for class_name in CLASSES:

    items = by_class[class_name]

    random.shuffle(items)

    if len(items) < 2:
        train_samples.extend(items)
        continue

    val_count = max(
        1,
        int(len(items) * VAL_RATIO)
    )

    if val_count >= len(items):
        val_count = len(items) - 1

    val_items = items[:val_count]
    train_items = items[val_count:]

    train_samples.extend(train_items)
    val_samples.extend(val_items)

    print(
        f"{class_name:<30}"
        f"train={len(train_items):<5}"
        f"val={len(val_items)}"
    )


random.shuffle(train_samples)
random.shuffle(val_samples)

print()
print(f"Training images:   {len(train_samples)}")
print(f"Validation images: {len(val_samples)}")
print()


# ============================================================
# TRAINING TRANSFORMS
# ============================================================

train_transform = transforms.Compose([

    transforms.Resize(
        (IMAGE_SIZE, IMAGE_SIZE)
    ),

    transforms.RandomHorizontalFlip(
        p=0.5
    ),

    transforms.RandomRotation(
        15
    ),

    transforms.ColorJitter(
        brightness=0.20,
        contrast=0.20,
        saturation=0.20,
        hue=0.05
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        [0.485, 0.456, 0.406],
        [0.229, 0.224, 0.225]
    ),
])


# ============================================================
# VALIDATION TRANSFORMS
# ============================================================

val_transform = transforms.Compose([

    transforms.Resize(
        (IMAGE_SIZE, IMAGE_SIZE)
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        [0.485, 0.456, 0.406],
        [0.229, 0.224, 0.225]
    ),
])


# ============================================================
# DATASET CLASS
# ============================================================

class CRAIDataset(Dataset):

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

        image_path, class_name, source = (
            self.samples[index]
        )

        try:

            image = Image.open(
                image_path
            ).convert("RGB")

        except Exception as error:

            raise RuntimeError(
                f"Failed to load image:\n"
                f"{image_path}\n"
                f"{error}"
            )

        image = self.transform(image)

        label = CLASS_TO_INDEX[class_name]

        return image, label


# ============================================================
# DATASETS
# ============================================================

train_dataset = CRAIDataset(
    train_samples,
    train_transform
)

val_dataset = CRAIDataset(
    val_samples,
    val_transform
)


# ============================================================
# DATALOADERS
# ============================================================

train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=NUM_WORKERS
)

val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=NUM_WORKERS
)


# ============================================================
# CLASS WEIGHTS
# ============================================================

counts = []

for class_name in CLASSES:

    counts.append(
        sum(
            1
            for _, name, _ in train_samples
            if name == class_name
        )
    )


total = sum(counts)
num_classes = len(CLASSES)

weights = []

for count in counts:

    if count == 0:
        weights.append(0.0)

    else:
        weights.append(
            total / (num_classes * count)
        )


class_weights = torch.tensor(
    weights,
    dtype=torch.float32
).to(DEVICE)


print("=" * 60)
print("CLASS WEIGHTS")
print("=" * 60)

for name, count, weight in zip(
    CLASSES,
    counts,
    weights
):

    print(
        f"{name:<30}"
        f"count={count:<5}"
        f"weight={weight:.3f}"
    )

print()


# ============================================================
# CREATE MOBILENETV3-SMALL
# ============================================================

print("=" * 60)
print("CREATING MOBILENETV3-SMALL")
print("=" * 60)

try:

    weights_enum = (
        models.MobileNet_V3_Small_Weights.DEFAULT
    )

    model = models.mobilenet_v3_small(
        weights=weights_enum
    )

    print("Pretrained ImageNet weights loaded.")

except Exception as error:

    print(
        "WARNING: Could not load pretrained weights."
    )

    print(error)

    model = models.mobilenet_v3_small(
        weights=None
    )


# ============================================================
# CHANGE FINAL CLASSIFIER
# ============================================================

input_features = (
    model.classifier[3].in_features
)

model.classifier[3] = nn.Linear(
    input_features,
    num_classes
)

model = model.to(DEVICE)

print(
    f"Output classes: {num_classes}"
)

print("Model ready.")
print()


# ============================================================
# LOSS FUNCTION
# ============================================================

criterion = nn.CrossEntropyLoss(
    weight=class_weights
)


# ============================================================
# OPTIMIZER
# ============================================================

optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=LEARNING_RATE,
    weight_decay=WEIGHT_DECAY
)


# ============================================================
# SCHEDULER
# ============================================================

scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer,
    mode="max",
    factor=0.5,
    patience=1
)


# ============================================================
# TRAIN ONE EPOCH
# ============================================================

def train_one_epoch():

    model.train()

    running_loss = 0.0
    correct = 0
    total_images = 0

    for images, labels in train_loader:

        images = images.to(DEVICE)
        labels = labels.to(DEVICE)

        optimizer.zero_grad()

        outputs = model(images)

        loss = criterion(
            outputs,
            labels
        )

        loss.backward()

        optimizer.step()

        running_loss += (
            loss.item()
            * images.size(0)
        )

        predictions = torch.argmax(
            outputs,
            dim=1
        )

        correct += (
            predictions == labels
        ).sum().item()

        total_images += labels.size(0)

    loss_value = (
        running_loss / total_images
    )

    accuracy = (
        correct / total_images
    ) * 100

    return loss_value, accuracy


# ============================================================
# VALIDATION
# ============================================================

def validate():

    model.eval()

    running_loss = 0.0
    correct = 0
    total_images = 0

    with torch.no_grad():

        for images, labels in val_loader:

            images = images.to(DEVICE)
            labels = labels.to(DEVICE)

            outputs = model(images)

            loss = criterion(
                outputs,
                labels
            )

            running_loss += (
                loss.item()
                * images.size(0)
            )

            predictions = torch.argmax(
                outputs,
                dim=1
            )

            correct += (
                predictions == labels
            ).sum().item()

            total_images += labels.size(0)

    loss_value = (
        running_loss / total_images
    )

    accuracy = (
        correct / total_images
    ) * 100

    return loss_value, accuracy


# ============================================================
# SAVE MODEL
# ============================================================

def save_model(
    epoch,
    validation_accuracy
):

    checkpoint = {

        "model_state_dict":
            model.state_dict(),

        "classes":
            CLASSES,

        "num_classes":
            num_classes,

        "image_size":
            IMAGE_SIZE,

        "model_name":
            "MobileNetV3-Small",

        "epoch":
            epoch,

        "validation_accuracy":
            validation_accuracy,
    }

    torch.save(
        checkpoint,
        MODEL_PATH
    )

    with open(
        CLASSES_PATH,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            CLASSES,
            file,
            indent=4
        )


# ============================================================
# START TRAINING
# ============================================================

print("=" * 60)
print("STARTING CRAI V2 TRAINING")
print("=" * 60)
print()

start_time = time.time()

best_accuracy = 0.0


for epoch in range(1, EPOCHS + 1):

    print(
        f"Epoch {epoch}/{EPOCHS}"
    )

    train_loss, train_accuracy = (
        train_one_epoch()
    )

    val_loss, val_accuracy = (
        validate()
    )

    scheduler.step(
        val_accuracy
    )

    current_lr = (
        optimizer.param_groups[0]["lr"]
    )

    print(
        f"Train Loss:          {train_loss:.4f}"
    )

    print(
        f"Train Accuracy:      {train_accuracy:.2f}%"
    )

    print(
        f"Validation Loss:     {val_loss:.4f}"
    )

    print(
        f"Validation Accuracy: {val_accuracy:.2f}%"
    )

    print(
        f"Learning Rate:       {current_lr:.7f}"
    )

    if val_accuracy > best_accuracy:

        best_accuracy = val_accuracy

        save_model(
            epoch,
            val_accuracy
        )

        print(
            "★ New best V2 model saved!"
        )

    print()


# ============================================================
# COMPLETE
# ============================================================

elapsed = (
    time.time() - start_time
)

print("=" * 60)
print("CRAI V2 TRAINING COMPLETE")
print("=" * 60)

print(
    f"Best validation accuracy: "
    f"{best_accuracy:.2f}%"
)

print(
    f"Training time: "
    f"{elapsed / 60:.2f} minutes"
)

print()
print(
    f"Model saved:"
)

print(
    MODEL_PATH
)

print()
print(
    f"Classes saved:"
)

print(
    CLASSES_PATH
)

print()
print("=" * 60)
print("CRAI V2 AI MODEL READY.")
print("=" * 60)