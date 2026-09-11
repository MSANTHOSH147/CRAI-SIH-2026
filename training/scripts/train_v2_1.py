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
# CRAI V2.1 - FIELD ROBUSTNESS CANDIDATE
# ============================================================

ROOT = Path(__file__).resolve().parents[2]

PLANTVILLAGE = (
    ROOT / "backend" / "data" / "datasets"
    / "plantvillage"
)

PLANTDOC = (
    ROOT / "backend" / "data" / "datasets"
    / "plantdoc" / "train"
)

BASELINE_MODEL = (
    ROOT / "backend" / "models"
    / "crai_disease_mobilenetv3_v2.pth"
)

CLASSES_PATH = (
    ROOT / "backend" / "models"
    / "classes_v2.json"
)

OUTPUT_DIR = (
    ROOT / "training" / "results"
    / "candidates" / "v2_1_field_robust"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)

MODEL_PATH = (
    OUTPUT_DIR
    / "crai_disease_mobilenetv3_v2_1.pth"
)


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
# REPRODUCIBILITY
# ============================================================

random.seed(SEED)
torch.manual_seed(SEED)

if torch.cuda.is_available():

    torch.cuda.manual_seed_all(
        SEED
    )


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)

print("=" * 70)
print("CRAI V2.1 - FIELD ROBUSTNESS CANDIDATE")
print("=" * 70)

print()
print(f"Device: {DEVICE}")
print(f"PlantVillage: {PLANTVILLAGE}")
print(f"PlantDoc:     {PLANTDOC}")
print(f"Output:       {MODEL_PATH}")
print()


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
# DATASET MAPPINGS
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


EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp",
}


# ============================================================
# COLLECT DATA
# ============================================================

def collect_images():

    samples = []

    print("=" * 70)
    print("COLLECTING TRAINING DATA")
    print("=" * 70)

    for folder_name, class_name in (
        PLANTVILLAGE_MAP.items()
    ):

        folder = (
            PLANTVILLAGE
            / folder_name
        )

        if not folder.exists():

            print(
                f"WARNING: Missing {folder}"
            )

            continue

        files = [
            path
            for path in folder.rglob("*")
            if (
                path.is_file()
                and path.suffix.lower()
                in EXTENSIONS
            )
        ]

        for path in files:

            samples.append(
                (
                    path,
                    class_name,
                    "PlantVillage"
                )
            )

        print(
            f"PlantVillage "
            f"{class_name:<28}"
            f"{len(files):>5}"
        )


    for folder_name, class_name in (
        PLANTDOC_MAP.items()
    ):

        folder = (
            PLANTDOC
            / folder_name
        )

        if not folder.exists():

            print(
                f"WARNING: Missing {folder}"
            )

            continue

        files = [
            path
            for path in folder.rglob("*")
            if (
                path.is_file()
                and path.suffix.lower()
                in EXTENSIONS
            )
        ]

        for path in files:

            samples.append(
                (
                    path,
                    class_name,
                    "PlantDoc"
                )
            )

        print(
            f"PlantDoc     "
            f"{class_name:<28}"
            f"{len(files):>5}"
        )


    return samples


samples = collect_images()


if not samples:

    raise RuntimeError(
        "No training images found."
    )


print()
print(
    f"Total images: {len(samples)}"
)


# ============================================================
# GROUP BY CLASS
# ============================================================

by_class = {
    class_name: []
    for class_name in CLASSES
}


for sample in samples:

    by_class[
        sample[1]
    ].append(sample)


# ============================================================
# STRATIFIED SPLIT
# ============================================================

train_samples = []
val_samples = []

print()
print("=" * 70)
print("CREATING STRATIFIED SPLIT")
print("=" * 70)

for class_name in CLASSES:

    items = list(
        by_class[class_name]
    )

    random.shuffle(items)

    if len(items) < 2:

        train_samples.extend(
            items
        )

        continue

    val_count = max(
        1,
        int(
            len(items)
            * VAL_RATIO
        )
    )

    if val_count >= len(items):

        val_count = (
            len(items) - 1
        )

    val_items = (
        items[:val_count]
    )

    train_items = (
        items[val_count:]
    )

    train_samples.extend(
        train_items
    )

    val_samples.extend(
        val_items
    )

    print(
        f"{class_name:<32}"
        f"train={len(train_items):<5}"
        f"val={len(val_items)}"
    )


random.shuffle(train_samples)
random.shuffle(val_samples)


print()
print(
    f"Training images:   {len(train_samples)}"
)

print(
    f"Validation images: {len(val_samples)}"
)


# ============================================================
# V2.1 TRAINING AUGMENTATION
# ============================================================

train_transform = transforms.Compose([

    transforms.RandomResizedCrop(
        IMAGE_SIZE,
        scale=(0.70, 1.0),
        ratio=(0.85, 1.15)
    ),

    transforms.RandomHorizontalFlip(
        p=0.5
    ),

    transforms.RandomRotation(
        degrees=15
    ),

    transforms.ColorJitter(
        brightness=0.25,
        contrast=0.25,
        saturation=0.20,
        hue=0.04
    ),

    transforms.RandomApply(
        [
            transforms.GaussianBlur(
                kernel_size=5,
                sigma=(0.1, 2.0)
            )
        ],
        p=0.20
    ),

    transforms.RandomGrayscale(
        p=0.03
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        [0.485, 0.456, 0.406],
        [0.229, 0.224, 0.225]
    ),
])


# ============================================================
# VALIDATION TRANSFORM
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
# DATASET
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

        path, class_name, source = (
            self.samples[index]
        )

        image = Image.open(
            path
        ).convert("RGB")

        image = self.transform(
            image
        )

        label = CLASS_TO_INDEX[
            class_name
        ]

        return image, label


train_dataset = CRAIDataset(
    train_samples,
    train_transform
)

val_dataset = CRAIDataset(
    val_samples,
    val_transform
)


# ============================================================
# LOADERS
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

    count = sum(
        1
        for _, name, _
        in train_samples
        if name == class_name
    )

    counts.append(
        count
    )


total_count = sum(counts)

weights = []

for count in counts:

    if count == 0:

        weights.append(
            0.0
        )

    else:

        weights.append(
            total_count
            / (
                len(CLASSES)
                * count
            )
        )


class_weights = torch.tensor(
    weights,
    dtype=torch.float32
).to(DEVICE)


# ============================================================
# MODEL
# ============================================================

print()
print("=" * 70)
print("CREATING MODEL")
print("=" * 70)

model = models.mobilenet_v3_small(
    weights=None
)

model.classifier[3] = nn.Linear(
    model.classifier[3].in_features,
    len(CLASSES)
)


# ============================================================
# START FROM V2
# ============================================================

print(
    "Loading frozen V2 weights..."
)

checkpoint = torch.load(
    BASELINE_MODEL,
    map_location=DEVICE,
    weights_only=False
)

if isinstance(checkpoint, dict):

    if "model_state_dict" in checkpoint:

        state_dict = (
            checkpoint[
                "model_state_dict"
            ]
        )

    elif "state_dict" in checkpoint:

        state_dict = (
            checkpoint[
                "state_dict"
            ]
        )

    else:

        state_dict = checkpoint

else:

    state_dict = checkpoint


model.load_state_dict(
    state_dict,
    strict=True
)

model = model.to(DEVICE)


print(
    "V2 weights loaded."
)


# ============================================================
# LOSS / OPTIMIZER
# ============================================================

criterion = nn.CrossEntropyLoss(
    weight=class_weights
)

optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=LEARNING_RATE,
    weight_decay=WEIGHT_DECAY
)

scheduler = (
    torch.optim.lr_scheduler
    .ReduceLROnPlateau(
        optimizer,
        mode="max",
        factor=0.5,
        patience=1
    )
)


# ============================================================
# TRAIN
# ============================================================

def train_one_epoch():

    model.train()

    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in train_loader:

        images = images.to(
            DEVICE
        )

        labels = labels.to(
            DEVICE
        )

        optimizer.zero_grad()

        outputs = model(
            images
        )

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

        predictions = (
            torch.argmax(
                outputs,
                dim=1
            )
        )

        correct += (
            predictions == labels
        ).sum().item()

        total += labels.size(0)


    return (
        running_loss / total,
        correct / total * 100
    )


# ============================================================
# VALIDATE
# ============================================================

def validate():

    model.eval()

    running_loss = 0.0
    correct = 0
    total = 0

    with torch.inference_mode():

        for images, labels in val_loader:

            images = images.to(
                DEVICE
            )

            labels = labels.to(
                DEVICE
            )

            outputs = model(
                images
            )

            loss = criterion(
                outputs,
                labels
            )

            running_loss += (
                loss.item()
                * images.size(0)
            )

            predictions = (
                torch.argmax(
                    outputs,
                    dim=1
                )
            )

            correct += (
                predictions == labels
            ).sum().item()

            total += labels.size(0)


    return (
        running_loss / total,
        correct / total * 100
    )


# ============================================================
# SAVE
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
            len(CLASSES),

        "image_size":
            IMAGE_SIZE,

        "model_name":
            "MobileNetV3-Small",

        "candidate":
            "V2.1",

        "experiment":
            "field_robust_augmentation",

        "epoch":
            epoch,

        "validation_accuracy":
            validation_accuracy,

        "seed":
            SEED,

    }

    torch.save(
        checkpoint,
        MODEL_PATH
    )


# ============================================================
# TRAINING LOOP
# ============================================================

print()
print("=" * 70)
print("STARTING V2.1 TRAINING")
print("=" * 70)

start_time = time.time()

best_accuracy = 0.0

for epoch in range(
    1,
    EPOCHS + 1
):

    print()
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

    print(
        f"Train Loss:       {train_loss:.4f}"
    )

    print(
        f"Train Accuracy:   {train_accuracy:.2f}%"
    )

    print(
        f"Validation Loss:  {val_loss:.4f}"
    )

    print(
        f"Validation Acc:   {val_accuracy:.2f}%"
    )

    print(
        f"Learning Rate:    "
        f"{optimizer.param_groups[0]['lr']:.7f}"
    )

    if val_accuracy > best_accuracy:

        best_accuracy = (
            val_accuracy
        )

        save_model(
            epoch,
            val_accuracy
        )

        print(
            "New best V2.1 candidate saved."
        )


# ============================================================
# COMPLETE
# ============================================================

elapsed = (
    time.time()
    - start_time
)

print()
print("=" * 70)
print("V2.1 TRAINING COMPLETE")
print("=" * 70)

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
    "Candidate model:"
)

print(
    MODEL_PATH
)

print()
print(
    "STATUS: V2.1 CANDIDATE READY"
)
