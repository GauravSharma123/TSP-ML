import sys
import os
from ultralytics import YOLO

# Load the YOLO model
model_path = os.path.join(os.path.dirname(__file__), "../../public/models/yolo11n-cls-trained-synth_v2.pt")
print(f"Loading model from: {model_path}")
model = YOLO(model_path)
class_names = model.names

def classify_image(image_path):
    print(f"Classifying image: {image_path}")
    results = model(image_path)
    res = results[0]
    if res.probs is not None:
        class_id = int(res.probs.top1)
        return class_names[class_id]
    else:
        return "No prediction"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python run_yolo.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} does not exist.")
        sys.exit(1)

    class_name = classify_image(image_path)
    print(f"Prediction: {class_name}")