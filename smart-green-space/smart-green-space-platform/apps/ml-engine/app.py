from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
from PIL import Image
import io
import os
import tensorflow as tf

app = FastAPI(title="Smart Green Space ML Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "saved_model/tree_analyzer.keras"

model = None

@app.on_event("startup")
def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        print("Loading compiled Keras model...")
        model = tf.keras.models.load_model(MODEL_PATH)
    else:
        print("WARNING: Model not found. Run train.py first!")

@app.post("/api/analyze-flora")
async def analyze_flora(file: UploadFile = File(...)):
    if model is None:
        return {"error": "Model not loaded. Please run train.py first."}, 500

    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    image = image.resize((224, 224))
    
    img_array = np.array(image) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    prediction = model.predict(img_array)
    score = float(prediction[0][0])
    
    # Keras flow_from_directory sorts classes alphabetically: 'diseased' -> 0, 'healthy' -> 1
    is_healthy = score > 0.5
    confidence = score if is_healthy else (1.0 - score)
    
    result = "Healthy Canopy" if is_healthy else "Pathogen Detected (Fungal Blight)"
    action = "No intervention needed." if is_healthy else "Deploy localized fungicide; inspect surrounding nodes."
    
    return {
        "status": "success",
        "diagnosis": result,
        "confidence": round(confidence * 100, 1),
        "action": action
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
