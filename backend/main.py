import os
import base64
import urllib.request
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with your Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cascade_filename = "haarcascade_frontalface_default.xml"
if not os.path.exists(cascade_filename):
    url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml"
    urllib.request.urlretrieve(url, cascade_filename)

face_cascade = cv2.CascadeClassifier(cascade_filename)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "proctor-engine"}

@app.websocket("/ws/proctor")
async def proctor_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if not data.startswith("data:image"):
                continue

            encoded_data = data.split(",")[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            frame = cv2.flip(frame, 1)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)

            faces = face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=7, minSize=(120, 120)
            )

            warnings = []
            significant_faces = [f for f in faces if f[2] > 120 and f[3] > 120]
            face_count = len(significant_faces)

            if face_count == 0:
                warnings.append("NO FACE DETECTED")
            elif face_count > 1:
                warnings.append("MULTIPLE FACES DETECTED")
            else:
                (x, y, w, h) = significant_faces[0]
                frame_width = frame.shape[1]
                frame_center_x = frame_width / 2.0
                face_center_x = x + (w / 2.0)
                offset = face_center_x - frame_center_x
                threshold = frame_width * 0.12

                if offset > threshold:
                    warnings.append("HEAD SHIFTED RIGHT")
                elif offset < -threshold:
                    warnings.append("HEAD SHIFTED LEFT")

            await websocket.send_json({
                "face_count": face_count,
                "warnings": warnings
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Error: {e}")