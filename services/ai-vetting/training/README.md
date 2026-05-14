# Device Condition Classifier — Training

## Dataset setup
Place smartphone images into the four class folders:
- training/dataset/train/Mint/     (pristine, no marks)
- training/dataset/train/Good/     (minor scratches, fully functional)
- training/dataset/train/Fair/     (visible wear, functional)
- training/dataset/train/Poor/     (cracked screen or heavy damage)

Minimum 50 images per class recommended. 80+ per class for reliable accuracy.

## Run training
From services/ai-vetting/:
  pip install -r requirements.txt
  python training/train.py

Output: condition_model.pt (saved to services/ai-vetting/)
Training log: training/training_history.json

## Model architecture
EfficientNet-B0 pretrained on ImageNet, final classifier replaced with 4-class head.
Fine-tuned for 10 epochs, Adam optimizer lr=1e-4, StepLR scheduler.
