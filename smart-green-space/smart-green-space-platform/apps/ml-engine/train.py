import os
import shutil
import numpy as np
from PIL import Image, ImageDraw
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# 1. Dataset Generation Directory
DATA_DIR = "./dataset"
CLASSES = ["healthy", "diseased"]
IMG_SIZE = (224, 224)
SAMPLES_PER_CLASS = 50

def generate_synthetic_data():
    print("Generating synthetic dataset to simulate local training...")
    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)
    
    for cls in CLASSES:
        os.makedirs(os.path.join(DATA_DIR, cls), exist_ok=True)
        
    for i in range(SAMPLES_PER_CLASS):
        # Generate Healthy (Generic Green Leaf Mock)
        img_h = Image.new('RGB', IMG_SIZE, color=(34, 139, 34))
        draw_h = ImageDraw.Draw(img_h)
        # Add some vein-like lines
        draw_h.line([(112, 0), (112, 224)], fill=(0, 100, 0), width=3)
        # Add slight noise
        noise = np.random.randint(0, 30, (224, 224, 3), dtype=np.uint8)
        img_array = np.array(img_h) + noise
        img_h = Image.fromarray(np.clip(img_array, 0, 255).astype('uint8'))
        img_h.save(os.path.join(DATA_DIR, "healthy", f"healthy_{i}.jpg"))
        
        # Generate Diseased (Fungal Leaf Spot Mock)
        img_d = Image.new('RGB', IMG_SIZE, color=(34, 139, 34))
        draw_d = ImageDraw.Draw(img_d)
        draw_d.line([(112, 0), (112, 224)], fill=(0, 100, 0), width=3)
        # Add fungal blight brown spots
        for _ in range(np.random.randint(5, 15)):
            cx = np.random.randint(20, 204)
            cy = np.random.randint(20, 204)
            r = np.random.randint(5, 25)
            draw_d.ellipse([(cx-r, cy-r), (cx+r, cy+r)], fill=(139, 69, 19))
        
        img_array = np.array(img_d) + noise
        img_d = Image.fromarray(np.clip(img_array, 0, 255).astype('uint8'))
        img_d.save(os.path.join(DATA_DIR, "diseased", f"diseased_{i}.jpg"))
    print(f"Generated {SAMPLES_PER_CLASS * 2} images.")

# 2. Model Training Pipeline
def train_model():
    print("Initializing MobileNetV2 Transfer Learning Pipeline...")
    datagen = ImageDataGenerator(rescale=1./255, validation_split=0.2)
    
    train_gen = datagen.flow_from_directory(
        DATA_DIR,
        target_size=IMG_SIZE,
        batch_size=16,
        class_mode='binary',
        subset='training'
    )
    
    val_gen = datagen.flow_from_directory(
        DATA_DIR,
        target_size=IMG_SIZE,
        batch_size=16,
        class_mode='binary',
        subset='validation'
    )
    
    # Load Pre-trained Base Model (without classification head)
    base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
    base_model.trainable = False  # Freeze base weights for rapid training

    # Add custom diagnostic head
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dropout(0.2)(x)
    predictions = Dense(1, activation='sigmoid')(x)
    
    model = Model(inputs=base_model.input, outputs=predictions)
    
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    
    print("Training Edge Model (Transfer Learning)...")
    model.fit(
        train_gen,
        epochs=3,
        validation_data=val_gen,
        verbose=1
    )
    
    # Save the compiled model
    os.makedirs('saved_model', exist_ok=True)
    model.save('saved_model/tree_analyzer.keras')
    print("SUCCESS: Model saved to saved_model/tree_analyzer.keras")

if __name__ == "__main__":
    generate_synthetic_data()
    train_model()
