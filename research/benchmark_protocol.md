# CRAI Vision Benchmark Protocol V1

## Objective

Compare disease-classification models for CRAI edge deployment.

## Frozen baseline

Model:
MobileNetV3-Small V2

Checkpoint:
backend/models/crai_disease_mobilenetv3_v2.pth

Classes:
backend/models/classes_v2.json

The baseline checkpoint must not be modified.

## Required metrics

- Accuracy
- Macro Precision
- Macro Recall
- Macro F1
- Per-class Precision
- Per-class Recall
- Per-class F1
- Confusion Matrix
- Parameter count
- Checkpoint size
- CPU inference latency
- Throughput

## Robustness evaluation

Evaluate the same test images under:

1. Original
2. Blur
3. Reduced brightness
4. Increased brightness
5. Gaussian noise
6. Partial occlusion
7. Reduced resolution

## Deployment evaluation

Candidate models should additionally be evaluated for:

- ONNX export
- ONNX Runtime compatibility
- Quantization feasibility
- Qualcomm AI Hub compatibility

## Selection principle

CRAI does not select a model using accuracy alone.

The selected model must provide a useful balance of:

- predictive quality
- class-level reliability
- robustness
- latency
- model size
- edge deployment compatibility

## Reproducibility

All candidate models must use:

- identical class mapping
- identical evaluation split
- identical preprocessing where applicable
- fixed random seed
- recorded configuration
- recorded checkpoint
- recorded evaluation results
