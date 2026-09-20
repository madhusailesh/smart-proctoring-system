import base64
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import urllib.request
import os

app = FastAPI()

# HaarCascade file load/download handle karna
cascade_filename = "haarcascade_frontalface_default.xml"
if not os.path.exists(cascade_filename):
    url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml"
    urllib.request.urlretrieve(url, cascade_filename)

face_cascade = cv2.CascadeClassifier(cascade_filename)

@app.websocket("/ws/proctor")
async def proctor_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Next.js Client Connected")

    try:
        while True:
            # 1. Base64 frame receive karo
            data = await websocket.receive_text()

            if not data.startswith("data:image"):
                continue

            # Image decode
            encoded_data = data.split(",")[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100))

            warnings = []
            face_count = len(faces)

            # 2. Rules / Alerts
            if face_count == 0:
                warnings.append("NO FACE DETECTED")
            elif face_count > 1:
                warnings.append("MULTIPLE FACES DETECTED")
            else:
                # Face Present -> Check Position
                (x, y, w, h) = faces[0]
                frame_center_x = frame.shape[1] / 2
                face_center_x = x + (w / 2)

                offset = face_center_x - frame_center_x
                threshold = frame.shape[1] * 0.15

                if offset > threshold:
                    warnings.append("LOOKING RIGHT")
                elif offset < -threshold:
                    warnings.append("LOOKING LEFT")

            # Response Send
            await websocket.send_json({
                "face_count": face_count,
                "warnings": warnings
            })

    except WebSocketDisconnect:
        print("Client Disconnected")
    except Exception as e:
        print(f"Error: {e}")