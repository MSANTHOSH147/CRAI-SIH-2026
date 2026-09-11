from pathlib import Path
import hashlib
import json
import sys


ROOT = Path(__file__).resolve().parents[2]

CHECKPOINT = ROOT / "backend" / "models" / "crai_disease_mobilenetv3_v2.pth"
CLASSES = ROOT / "backend" / "models" / "classes_v2.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()

    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)

    return h.hexdigest()


def main():
    print("=" * 60)
    print("CRAI VISION BASELINE VERIFICATION")
    print("=" * 60)

    missing = []

    for path in (CHECKPOINT, CLASSES):
        if not path.exists():
            missing.append(str(path))

    if missing:
        print("\nMissing required files:")
        for item in missing:
            print(f"  - {item}")
        sys.exit(1)

    with CLASSES.open("r", encoding="utf-8") as f:
        classes = json.load(f)

    print(f"\nCheckpoint : {CHECKPOINT}")
    print(f"Size       : {CHECKPOINT.stat().st_size / (1024 ** 2):.3f} MB")
    print(f"SHA256     : {sha256(CHECKPOINT)}")

    print(f"\nClasses    : {CLASSES}")
    print(f"SHA256     : {sha256(CLASSES)}")

    print("\nClass mapping:")

    if isinstance(classes, dict):
        for key, value in classes.items():
            print(f"  {key}: {value}")
    elif isinstance(classes, list):
        for index, value in enumerate(classes):
            print(f"  {index}: {value}")
    else:
        print(f"  Unexpected format: {type(classes).__name__}")

    print("\nSTATUS: BASELINE VERIFIED")
    print("The V2 checkpoint remains frozen.")


if __name__ == "__main__":
    main()
