import json
import random
import time
from pathlib import Path
from collections import Counter

import torch
import torch.nn as nn

from torch.utils.data import (
    Dataset,
    DataLoader,
    WeightedRandomSampler
)

from torchvision import models, transforms

from PIL import Image


# ============================================================
# CRAI V3 - PLANT DISEASE AI TRAINING
# ============================================================

print("=" * 65)
print("CRAI V3 - Plant Disease AI Training")
print("=" * 65)


# ============================================================
# CONFIGURATION
# ============================================================

SEED = 42

EPOCHS = 8

BATCH_SIZE = 32

LEARNING_RATE = 0.0001

WEIGHT_DECAY = 0.0001

IMAGE_SIZE = 224

PLANTDOC_OVERSAMPLE = 4.0

NUM_WORKERS = 0


# ============================================================
# REPRODUCIBILITY
# ============================================================

random.seed(SEED)

torch.manual_seed(SEED)

if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

PLANTVILLAGE_DIR = (
    BASE_DIR
    / "data"
    / "datasets"
    / "plantvillage"
)

PLANTDOC_DIR = (
    BASE_DIR
    / "data"
    / "datasets"
    / "plantdoc"
    / "train"
)

MODEL_DIR = (
    BASE_DIR
    / "models"
)

V2_MODEL = (
    MODEL_DIR
    / "crai_disease_mobilenetv3_v2.pth"
)

V2_CLASSES = (
    MODEL_DIR
    / "classes_v2.json"
)

V3_MODEL = (
    MODEL_DIR
    / "crai_disease_mobilenetv3_v3.pth"
)

V3_CLASSES = (
    MODEL_DIR
    / "classes_v3.json"
)


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)

print(f"Device:       {DEVICE}")
print(f"PlantVillage: {PLANTVILLAGE_DIR}")
print(f"PlantDoc:     {PLANTDOC_DIR}")
print(f"V2 model:     {V2_MODEL}")
print(f"V3 output:    {MODEL_DIR}")
print()


# ============================================================
# CHECK PATHS
# ============================================================

if not PLANTVILLAGE_DIR.exists():

    raise FileNotFoundError(
        f"PlantVillage not found:\n"
        f"{PLANTVILLAGE_DIR}"
    )


if not PLANTDOC_DIR.exists():

    raise FileNotFoundError(
        f"PlantDoc not found:\n"
        f"{PLANTDOC_DIR}"
    )


if not V2_MODEL.exists():

    raise FileNotFoundError(
        f"V2 model not found:\n"
        f"{V2_MODEL}"
    )


if not V2_CLASSES.exists():

    raise FileNotFoundError(
        f"V2 classes not found:\n"
        f"{V2_CLASSES}"
    )


MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# LOAD V2 CLASSES
# ============================================================

with open(
    V2_CLASSES,
    "r",
    encoding="utf-8"
) as f:

    CLASSES = json.load(f)


CLASS_TO_INDEX = {
    name: index
    for index, name in enumerate(CLASSES)
}


print("=" * 65)
print("CLASSES")
print("=" * 65)

for index, name in enumerate(CLASSES):

    print(
        f"{index:>2}: {name}"
    )

print()


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
# IMAGE EXTENSIONS
# ============================================================

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp",
}


# ============================================================
# COLLECT PLANTVILLAGE
# ============================================================

print("=" * 65)
print("LOADING PLANTVILLAGE")
print("=" * 65)


plantvillage_samples = []


for class_dir in sorted(
    PLANTVILLAGE_DIR.iterdir()
):

    if not class_dir.is_dir():
        continue

    class_name = class_dir.name

    if class_name not in CLASS_TO_INDEX:
        continue

    files = [
        p
        for p in class_dir.rglob("*")
        if (
            p.is_file()
            and p.suffix.lower()
            in IMAGE_EXTENSIONS
        )
    ]

    print(
        f"{class_name:<30}"
        f"{len(files):>6} images"
    )

    for path in files:

        plantvillage_samples.append(
            (
                path,
                class_name,
                "plantvillage"
            )
        )


print()


# ============================================================
# COLLECT PLANTDOC
# ============================================================

print("=" * 65)
print("LOADING PLANTDOC")
print("=" * 65)


plantdoc_samples = []


for folder_name, class_name in PLANTDOC_MAP.items():

    folder = (
        PLANTDOC_DIR
        / folder_name
    )

    if not folder.exists():

        print(
            f"WARNING: Missing {folder_name}"
        )

        continue

    files = [
        p
        for p in folder.rglob("*")
        if (
            p.is_file()
            and p.suffix.lower()
            in IMAGE_EXTENSIONS
        )
    ]

    print(
        f"{folder_name:<30}"
        f"{len(files):>6} images"
    )

    for path in files:

        plantdoc_samples.append(
            (
                path,
                class_name,
                "plantdoc"
            )
        )


print()


# ============================================================
# COMBINE
# ============================================================

all_samples = (
    plantvillage_samples
    + plantdoc_samples
)


print("=" * 65)
print("DATASET SUMMARY")
print("=" * 65)

print(
    f"PlantVillage images: "
    f"{len(plantvillage_samples)}"
)

print(
    f"PlantDoc images:     "
    f"{len(plantdoc_samples)}"
)

print(
    f"Combined images:     "
    f"{len(all_samples)}"
)

print(
    f"Classes:             "
    f"{len(CLASSES)}"
)

print()


# ============================================================
# CLASS DISTRIBUTION
# ============================================================

class_counts = Counter(
    sample[1]
    for sample in all_samples
)


print("Class distribution:")
print("-" * 65)

for class_name in CLASSES:

    print(
        f"{class_name:<30}"
        f"{class_counts[class_name]:>6}"
    )

print()


# ============================================================
# STRATIFIED TRAIN / VALIDATION SPLIT
# ============================================================

print("=" * 65)
print("CREATING TRAIN / VALIDATION SPLIT")
print("=" * 65)


by_class = {
    class_name: []
    for class_name in CLASSES
}


for sample in all_samples:

    by_class[
        sample[1]
    ].append(sample)


train_samples = []

val_samples = []


for class_name in CLASSES:

    items = by_class[class_name]

    random.shuffle(items)

    total = len(items)

    if total <= 1:

        train_count = total

    else:

        train_count = int(
            total * 0.80
        )

        train_count = max(
            1,
            min(
                train_count,
                total - 1
            )
        )


    class_train = (
        items[:train_count]
    )

    class_val = (
        items[train_count:]
    )


    train_samples.extend(
        class_train
    )

    val_samples.extend(
        class_val
    )


    print(
        f"{class_name:<30}"
        f"train={len(class_train):>4} "
        f"val={len(class_val):>4}"
    )


print()

print(
    f"Training images:   "
    f"{len(train_samples)}"
)

print(
    f"Validation images: "
    f"{len(val_samples)}"
)

print()


# ============================================================
# TRAINING TRANSFORMS
# ============================================================

# PlantVillage gets normal augmentation.
# PlantDoc gets stronger real-world augmentation.

plantvillage_transform = transforms.Compose([

    transforms.Resize(
        (IMAGE_SIZE, IMAGE_SIZE)
    ),

    transforms.RandomHorizontalFlip(
        p=0.5
    ),

    transforms.RandomRotation(
        degrees=15
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


plantdoc_transform = transforms.Compose([

    transforms.Resize(
        (IMAGE_SIZE, IMAGE_SIZE)
    ),

    transforms.RandomResizedCrop(
        IMAGE_SIZE,
        scale=(0.75, 1.0)
    ),

    transforms.RandomHorizontalFlip(
        p=0.5
    ),

    transforms.RandomVerticalFlip(
        p=0.10
    ),

    transforms.RandomRotation(
        degrees=25
    ),

    transforms.ColorJitter(
        brightness=0.30,
        contrast=0.30,
        saturation=0.30,
        hue=0.08
    ),

    transforms.RandomAffine(
        degrees=0,
        translate=(0.05, 0.05),
        scale=(0.90, 1.10)
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

validation_transform = transforms.Compose([

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
        training=True
    ):

        self.samples = samples

        self.training = training


    def __len__(self):

        return len(self.samples)


    def __getitem__(self, index):

        path, class_name, source = (
            self.samples[index]
        )

        image = Image.open(
            path
        ).convert("RGB")


        if self.training:

            if source == "plantdoc":

                image = plantdoc_transform(
                    image
                )

            else:

                image = plantvillage_transform(
                    image
                )

        else:

            image = validation_transform(
                image
            )


        label = CLASS_TO_INDEX[
            class_name
        ]


        return image, label


# ============================================================
# CREATE DATASETS
# ============================================================

train_dataset = CRAIDataset(
    train_samples,
    training=True
)


val_dataset = CRAIDataset(
    val_samples,
    training=False
)


# ============================================================
# BALANCED SAMPLING
# ============================================================

print("=" * 65)
print("CREATING BALANCED SAMPLER")
print("=" * 65)


train_class_counts = Counter(
    sample[1]
    for sample in train_samples
)


sample_weights = []


for path, class_name, source in train_samples:

    class_count = (
        train_class_counts[
            class_name
        ]
    )


    # Inverse square-root frequency.
    # This prevents tiny classes from receiving
    # absurdly large weights.

    class_weight = (
        1.0
        / (class_count ** 0.5)
    )


    # PlantDoc gets extra importance because
    # our external PlantDoc evaluation showed
    # strong domain-shift problems.

    source_weight = (
        PLANTDOC_OVERSAMPLE
        if source == "plantdoc"
        else 1.0
    )


    weight = (
        class_weight
        * source_weight
    )


    sample_weights.append(
        weight
    )


sample_weights = torch.tensor(
    sample_weights,
    dtype=torch.double
)


sampler = WeightedRandomSampler(
    weights=sample_weights,
    num_samples=len(train_samples),
    replacement=True
)


print(
    f"PlantDoc sampling multiplier: "
    f"{PLANTDOC_OVERSAMPLE}x"
)

print(
    "Balanced sampler ready."
)

print()


# ============================================================
# DATALOADERS
# ============================================================

train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    sampler=sampler,
    num_workers=NUM_WORKERS,
    pin_memory=False
)


val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=NUM_WORKERS,
    pin_memory=False
)


# ============================================================
# CREATE MODEL
# ============================================================

print("=" * 65)
print("LOADING V2 MODEL FOR V3 FINE-TUNING")
print("=" * 65)


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


# ============================================================
# LOAD V2 CHECKPOINT
# ============================================================

checkpoint = torch.load(
    V2_MODEL,
    map_location=DEVICE
)


if isinstance(
    checkpoint,
    dict
) and "model_state_dict" in checkpoint:

    state_dict = (
        checkpoint["model_state_dict"]
    )

else:

    state_dict = checkpoint


model.load_state_dict(
    state_dict,
    strict=True
)


print(
    "V2 weights loaded successfully."
)

print(
    f"Output classes: {len(CLASSES)}"
)

print()


# ============================================================
# MOVE MODEL
# ============================================================

model = model.to(DEVICE)


# ============================================================
# LOSS
# ============================================================

criterion = nn.CrossEntropyLoss(
    label_smoothing=0.05
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
# LR SCHEDULER
# ============================================================

scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
    optimizer,
    T_max=EPOCHS,
    eta_min=1e-6
)


# ============================================================
# TRAINING FUNCTIONS
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


        torch.nn.utils.clip_grad_norm_(
            model.parameters(),
            max_norm=1.0
        )


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


        total += labels.size(0)


    epoch_loss = (
        running_loss / total
    )


    epoch_accuracy = (
        correct
        / total
        * 100
    )


    return (
        epoch_loss,
        epoch_accuracy
    )


# ============================================================
# VALIDATION FUNCTION
# ============================================================

def validate():

    model.eval()

    running_loss = 0.0

    correct = 0

    total = 0


    with torch.no_grad():

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


            predictions = torch.argmax(
                outputs,
                dim=1
            )


            correct += (
                predictions == labels
            ).sum().item()


            total += labels.size(0)


    validation_loss = (
        running_loss / total
    )


    validation_accuracy = (
        correct
        / total
        * 100
    )


    return (
        validation_loss,
        validation_accuracy
    )


# ============================================================
# SAVE CLASSES
# ============================================================

with open(
    V3_CLASSES,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        CLASSES,
        f,
        indent=4
    )


# ============================================================
# TRAINING
# ============================================================

print("=" * 65)
print("STARTING CRAI V3 TRAINING")
print("=" * 65)

print(
    f"Epochs:              {EPOCHS}"
)

print(
    f"Batch size:          {BATCH_SIZE}"
)

print(
    f"Learning rate:       {LEARNING_RATE}"
)

print(
    f"PlantDoc multiplier: {PLANTDOC_OVERSAMPLE}x"
)

print(
    "Starting from:       V2"
)

print()


best_validation_accuracy = 0.0

best_epoch = 0

start_time = time.time()


for epoch in range(
    1,
    EPOCHS + 1
):

    print(
        f"Epoch {epoch}/{EPOCHS}"
    )


    train_loss, train_accuracy = (
        train_one_epoch()
    )


    validation_loss, validation_accuracy = (
        validate()
    )


    current_lr = (
        optimizer.param_groups[0]["lr"]
    )


    print(
        f"Train Loss:          "
        f"{train_loss:.4f}"
    )

    print(
        f"Train Accuracy:      "
        f"{train_accuracy:.2f}%"
    )

    print(
        f"Validation Loss:     "
        f"{validation_loss:.4f}"
    )

    print(
        f"Validation Accuracy: "
        f"{validation_accuracy:.2f}%"
    )

    print(
        f"Learning Rate:       "
        f"{current_lr:.7f}"
    )


    if (
        validation_accuracy
        > best_validation_accuracy
    ):

        best_validation_accuracy = (
            validation_accuracy
        )

        best_epoch = epoch


        torch.save(
            {
                "model_state_dict":
                    model.state_dict(),

                "classes":
                    CLASSES,

                "validation_accuracy":
                    validation_accuracy,

                "epoch":
                    epoch,

                "version":
                    "CRAI_V3",

                "source_model":
                    "CRAI_V2",
            },
            V3_MODEL
        )


        print(
            "★ New best V3 model saved!"
        )


    scheduler.step()


    print()


# ============================================================
# COMPLETE
# ============================================================

training_time = (
    time.time()
    - start_time
)


print("=" * 65)
print("CRAI V3 TRAINING COMPLETE")
print("=" * 65)

print(
    f"Best validation accuracy: "
    f"{best_validation_accuracy:.2f}%"
)

print(
    f"Best epoch:              "
    f"{best_epoch}"
)

print(
    f"Training time:           "
    f"{training_time / 60:.2f} minutes"
)

print()

print(
    "Model saved:"
)

print(
    V3_MODEL
)

print()

print(
    "Classes saved:"
)

print(
    V3_CLASSES
)

print()

print("=" * 65)
print("CRAI V3 AI MODEL READY.")
print("=" * 65)