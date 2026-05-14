import os
import torch
import torchvision
import torchvision.transforms as T
import torchvision.models as models
from torchvision import datasets
from torch import nn, optim
import json

CLASSES = ["Mint", "Good", "Fair", "Poor"]
DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset", "train")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "condition_model.pt")
EPOCHS = 10
BATCH_SIZE = 16
LR = 1e-4

transform = T.Compose([
    T.Resize((224, 224)),
    T.RandomHorizontalFlip(),
    T.ColorJitter(brightness=0.2, contrast=0.2),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

print(f"Loading dataset from {DATASET_DIR}")
dataset = datasets.ImageFolder(DATASET_DIR, transform=transform)
print(f"Classes found: {dataset.classes}")
print(f"Total images: {len(dataset)}")

loader = torch.utils.data.DataLoader(
    dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0
)

model = models.efficientnet_b0(weights="IMAGENET1K_V1")
model.classifier[1] = nn.Linear(model.classifier[1].in_features, 4)

optimizer = optim.Adam(model.parameters(), lr=LR)
criterion = nn.CrossEntropyLoss()
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=0.5)

history = []
print(f"\nStarting training for {EPOCHS} epochs...")

for epoch in range(EPOCHS):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    for images, labels in loader:
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        running_loss += loss.item()
        _, predicted = torch.max(outputs, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()
    scheduler.step()
    acc = round(correct / total * 100, 2) if total > 0 else 0
    avg_loss = round(running_loss / len(loader), 4)
    history.append({"epoch": epoch + 1, "loss": avg_loss, "accuracy": acc})
    print(f"Epoch {epoch+1}/{EPOCHS} — loss: {avg_loss} — accuracy: {acc}%")

torch.save(model.state_dict(), OUTPUT_PATH)
print(f"\nModel saved to {OUTPUT_PATH}")

with open(os.path.join(os.path.dirname(__file__), "training_history.json"), "w") as f:
    json.dump(history, f, indent=2)
print("Training history saved to training/training_history.json")
