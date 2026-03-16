import io
import base64
from pathlib import Path
from PIL import Image, ImageDraw
import json
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import onnxruntime as ort

# ================= Config =================
IMG_SIZE = 960
app = FastAPI()

# Logging
logging.basicConfig(level=logging.INFO)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # any origin
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= Helpers =================
def read_settings(entry):
    try:
        settings_path = Path.home() / "AppData" / "Roaming" / "com.mohaned.waldo" / "store.json"
        with open(settings_path, "r") as f:
            settings = json.load(f)
            return settings.get(entry, "")
    except FileNotFoundError:
        logging.warning("Settings file not found, using default saveLocation.")
        return str(Path.home() / "AppData" / "Roaming" / "com.mohaned.waldo")

def crop_image(image, tile_size):
    """Yield cropped tiles with their top-left offsets."""
    img_w, img_h = image.size
    for y in range(0, img_h, tile_size):
        for x in range(0, img_w, tile_size):
            box = (x, y, min(x + tile_size, img_w), min(y + tile_size, img_h))
            yield image.crop(box), x, y

def encode_image_to_base64(image):
    """Encode PIL image to base64 string."""
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode()

# ================= Model Loader =================
model = None
session = None
input_name = None

def load_model():
    global model, session, input_name
    if session is None:
        model_path = Path(__file__).resolve().parent / "models" / "best.onnx"
        if not model_path.exists():
            raise FileNotFoundError(f"ONNX model not found: {model_path}")

        session = ort.InferenceSession(str(model_path))
        input_name = session.get_inputs()[0].name
        logging.info("✅ ONNX model loaded.")

# ================= Endpoints =================
@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI ONNX server!"}

@app.post("/infer")
async def infer(request: Request):
    load_model()  # lazy load
    try:
        data = await request.json()
        img_path = data.get("path")
        if not img_path:
            return JSONResponse(status_code=400, content={"error": "No path provided."})

        # Load original image
        orig_img = Image.open(img_path).convert("RGB")
        draw = ImageDraw.Draw(orig_img)
        detections = []

        img_w, img_h = orig_img.size
        longest_side = max(img_w, img_h)

        if longest_side <= IMG_SIZE:
            scale = IMG_SIZE / longest_side if longest_side > 0 else 1.0
            new_w = max(1, int(round(img_w * scale)))
            new_h = max(1, int(round(img_h * scale)))
            try:
                resample = Image.Resampling.LANCZOS
            except AttributeError:
                resample = Image.LANCZOS

            resized_img = orig_img.resize((new_w, new_h), resample=resample)

            # Prepare input for ONNX
            input_array = np.array(resized_img).astype("float32")
            input_array = input_array.transpose(2, 0, 1)[None, ...] / 255.0  # CHW, batch=1

            results = session.run(None, {input_name: input_array})
            # Parse ONNX results (assumes YOLO export format)
            boxes = results[0]  # adjust according to export
            scores = results[1]
            classes = results[2]
            for bbox, score, cls_id in zip(boxes, scores, classes):
                x1, y1, x2, y2 = bbox
                cls_name = str(cls_id)  # optionally map to names
                detections.append({"class": cls_name, "confidence": float(score), "bbox": [x1, y1, x2, y2]})
                draw.rectangle([x1, y1, x2, y2], outline="red", width=2)
                draw.text((x1, max(0, y1 - 10)), f"{cls_name} {score:.2f}", fill="red")
        else:
            for tile_img, offset_x, offset_y in crop_image(orig_img, IMG_SIZE):
                input_array = np.array(tile_img).astype("float32")
                input_array = input_array.transpose(2, 0, 1)[None, ...] / 255.0
                results = session.run(None, {input_name: input_array})
                boxes = results[0]
                scores = results[1]
                classes = results[2]
                for bbox, score, cls_id in zip(boxes, scores, classes):
                    x1, y1, x2, y2 = bbox
                    abs_x1, abs_y1, abs_x2, abs_y2 = x1 + offset_x, y1 + offset_y, x2 + offset_x, y2 + offset_y
                    cls_name = str(cls_id)
                    detections.append({"class": cls_name, "confidence": float(score), "bbox": [abs_x1, abs_y1, abs_x2, abs_y2]})
                    draw.rectangle([abs_x1, abs_y1, abs_x2, abs_y2], outline="red", width=2)
                    draw.text((abs_x1, max(0, abs_y1 - 10)), f"{cls_name} {score:.2f}", fill="red")

        save_path = Path(read_settings("saveLocation")) / "result.jpg"
        orig_img.save(save_path, format="JPEG")

        return {"detections": detections, "image_path": str(save_path)}

    except Exception as e:
        logging.exception("/infer failed")
        return JSONResponse(status_code=500, content={"error": str(e)})

# ================= Main =================
if __name__ == "__main__":
    import uvicorn
    import numpy as np

    print("Starting server...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
