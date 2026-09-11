from pathlib import Path
import json
import time
import hashlib
import csv

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]

CHECKPOINT = ROOT / "backend" / "models" / "crai_disease_mobilenetv3_v2.pth"
CLASSES_FILE = ROOT / "backend" / "models" / "classes_v2.json"

RESULTS_DIR = ROOT / "training" / "results" / "baseline_v2"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


IMAGE_SIZE = 224
WARMUP_RUNS = 10
BENCHMARK_RUNS = 50


def load_classes():
    with CLASSES_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        return [data[str(i)] for i in range(len(data))]

    return data


def build_model(num_classes):
    model = models.mobilenet_v3_small(weights=None)

    model.classifier[-1] = nn.Linear(
        model.classifier[-1].in_features,
        num_classes,
    )

    return model


def load_checkpoint(model):
    checkpoint = torch.load(
        CHECKPOINT,
        map_location="cpu",
        weights_only=False,
    )

    if isinstance(checkpoint, dict):
        if "model_state_dict" in checkpoint:
            state = checkpoint["model_state_dict"]
        elif "state_dict" in checkpoint:
            state = checkpoint["state_dict"]
        else:
            state = checkpoint
    else:
        state = checkpoint

    cleaned = {}

    for key, value in state.items():
        if key.startswith("module."):
            key = key[7:]
        cleaned[key] = value

    model.load_state_dict(cleaned, strict=True)

    return model


def checkpoint_sha256():
    h = hashlib.sha256()

    with CHECKPOINT.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)

    return h.hexdigest()


def benchmark_latency(model, tensor):
    model.eval()

    with torch.inference_mode():
        for _ in range(WARMUP_RUNS):
            model(tensor)

        start = time.perf_counter()

        for _ in range(BENCHMARK_RUNS):
            model(tensor)

        elapsed = time.perf_counter() - start

    return (elapsed / BENCHMARK_RUNS) * 1000.0


def main():
    print("=" * 70)
    print("CRAI VISION BENCHMARK - MOBILEV3-SMALL V2 BASELINE")
    print("=" * 70)

    classes = load_classes()

    print(f"\nClasses       : {len(classes)}")
    print(f"Checkpoint    : {CHECKPOINT.name}")
    print(f"SHA256        : {checkpoint_sha256()}")

    model = build_model(len(classes))
    model = load_checkpoint(model)
    model.eval()

    parameter_count = sum(
        parameter.numel()
        for parameter in model.parameters()
    )

    trainable_count = sum(
        parameter.numel()
        for parameter in model.parameters()
        if parameter.requires_grad
    )

    checkpoint_size_mb = CHECKPOINT.stat().st_size / (1024 * 1024)

    tensor = torch.randn(
        1,
        3,
        IMAGE_SIZE,
        IMAGE_SIZE,
    )

    latency_ms = benchmark_latency(model, tensor)

    result = {
        "benchmark_version": "CRAI_VISION_BENCHMARK_V1",
        "model": "MobileNetV3-Small V2",
        "checkpoint": str(CHECKPOINT.relative_to(ROOT)),
        "checkpoint_sha256": checkpoint_sha256(),
        "classes": len(classes),
        "input_size": f"{IMAGE_SIZE}x{IMAGE_SIZE}",
        "parameters": parameter_count,
        "trainable_parameters": trainable_count,
        "checkpoint_size_mb": round(checkpoint_size_mb, 4),
        "cpu_latency_ms": round(latency_ms, 4),
        "device": "CPU",
        "status": "BASELINE"
    }

    output_json = RESULTS_DIR / "benchmark.json"

    with output_json.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print("\nModel statistics")
    print("-" * 70)
    print(f"Parameters    : {parameter_count:,}")
    print(f"Trainable     : {trainable_count:,}")
    print(f"Checkpoint    : {checkpoint_size_mb:.3f} MB")
    print(f"CPU latency   : {latency_ms:.3f} ms")
    print(f"CPU throughput: {1000 / latency_ms:.2f} images/sec")

    print("\nSaved:")
    print(output_json)

    print("\nSTATUS: BASELINE BENCHMARK RECORDED")


if __name__ == "__main__":
    main()

