# server.py
from fastapi import FastAPI, Request
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image, ImageDraw
import torch
import io
import base64
from fastapi.responses import JSONResponse
import logging
import json
from pathlib import Path
import sys
from fastapi.middleware.cors import CORSMiddleware


# ================= Config =================
IMG_SIZE = 960
app = FastAPI()

def read_settings(entry):
    try:
        settings_path = Path.home() / "AppData" / "Roaming" / "com.mohaned.waldo" / "store.json"
        with open(settings_path, "r") as f:
            settings = json.load(f)
            return settings.get(entry, "")
    except FileNotFoundError:
        print(settings_path)
        logging.warning("Settings file not found, using default saveLocation.")
        return ""

# Logging
logging.basicConfig(level=logging.INFO)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # any origin matches
    allow_methods=["*"],       # allow all HTTP methods
    allow_headers=["*"],       # allow all headers
)

# ================= Helpers =================
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

# ================= Endpoints =================
@app.api_route("/", methods=["GET", "POST"])
def read_root():
    return {"message": "Welcome to the FastAPI server!"}

@app.post("/infer")
async def infer(request: Request):
    if request.method == "OPTIONS":
        # Preflight request — just OK it
        return JSONResponse(status_code=200, content={})

    data = await request.json()
    img_path = data.get("path")
    if not img_path:
        return JSONResponse(status_code=400, content={"error": "No path provided"})

    try:
        data = await request.json()
        img_path = data.get("path")
        if not img_path:
            return JSONResponse(status_code=400, content={"error": "No path provided."})
        
        # Print every request hitting /infer
        print("\n=== Incoming Request ===")
        print("Method:", request.method)
        print("Headers:", dict(request.headers))
        try:
            raw_body = await request.body()
            print("Raw body:", raw_body.decode(errors="ignore"))
        except Exception as e:
            print("Error reading body:", e)
        print("========================\n")

        # Try to parse JSON body
        try:
            data = await request.json()
        except Exception:
            return JSONResponse(status_code=400, content={"error": "Invalid JSON."})

        img_path = data.get("path")

        if not img_path:
            print("\n--- BAD REQUEST --- No 'path' provided ---\n")
            return JSONResponse(status_code=400, content={"error": "No path provided."})

        # Load original image
        orig_img = Image.open(img_path).convert("RGB")
        draw = ImageDraw.Draw(orig_img)
        detections = []

        img_w, img_h = orig_img.size
        longest_side = max(img_w, img_h)
        device = 0 if torch.cuda.is_available() else "cpu"

        if longest_side <= IMG_SIZE:
            scale = IMG_SIZE / longest_side if longest_side > 0 else 1.0
            new_w = max(1, int(round(img_w * scale)))
            new_h = max(1, int(round(img_h * scale)))
            try:
                resample = Image.Resampling.LANCZOS
            except AttributeError:
                resample = Image.LANCZOS

            resized_img = orig_img.resize((new_w, new_h), resample=resample)
            results = model(resized_img, imgsz=IMG_SIZE, device=device)

            for r in results:
                if r.boxes is not None:
                    for box in r.boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        conf = float(box.conf[0])
                        cls_id = int(box.cls[0])
                        cls_name = model.names[cls_id]
                        abs_x1 = x1 / scale
                        abs_y1 = y1 / scale
                        abs_x2 = x2 / scale
                        abs_y2 = y2 / scale

                        detections.append({
                            "class": cls_name,
                            "confidence": conf,
                            "bbox": [abs_x1, abs_y1, abs_x2, abs_y2],
                        })

                        draw.rectangle([abs_x1, abs_y1, abs_x2, abs_y2], outline="red", width=3)
                        draw.text((abs_x1, max(0, abs_y1 - 10)), f"{cls_name} {conf:.2f}", fill="red")
        else:
            for tile_img, offset_x, offset_y in crop_image(orig_img, IMG_SIZE):
                results = model(tile_img, imgsz=IMG_SIZE, device=device)
                for r in results:
                    if r.boxes is not None:
                        for box in r.boxes:
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            conf = float(box.conf[0])
                            cls_id = int(box.cls[0])
                            cls_name = model.names[cls_id]
                            abs_x1 = x1 + offset_x
                            abs_y1 = y1 + offset_y
                            abs_x2 = x2 + offset_x
                            abs_y2 = y2 + offset_y

                            detections.append({
                                "class": cls_name,
                                "confidence": conf,
                                "bbox": [abs_x1, abs_y1, abs_x2, abs_y2],
                            })

                            draw.rectangle([abs_x1, abs_y1, abs_x2, abs_y2], outline="red", width=3)
                            draw.text((abs_x1, max(0, abs_y1 - 10)), f"{cls_name} {conf:.2f}", fill="red")

        save_path = read_settings("saveLocation") + "\\result.jpg"
        orig_img.save(save_path, format="JPEG")

        return {"detections": detections, "image_path": save_path}

    except Exception as e:
        logging.exception("/infer failed")
        return JSONResponse(status_code=500, content={"error": str(e)})
    
# ================= Main =================
if __name__ == "__main__":
    model_path = Path(__file__).resolve().parent  / "best.pt"

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    model = YOLO(str(model_path))
    uvicorn.run(app, host="127.0.0.1", port=8000)
