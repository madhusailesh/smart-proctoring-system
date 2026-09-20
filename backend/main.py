import base64
import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

# MediaPipe Face Mesh Initialization
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=5,                # Multiple faces detect karne ke liye
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

@app.websocket("/ws/proctor")
async def proctor_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Next.js Client Connected")

    try:
        while True:
            # 1. Next.js se base64 image receive karo
            data = await websocket.receive_text()

            if not data.startswith("data:image"):
                continue

            # Base64 string ko OpenCV Image me convert karo
            encoded_data = data.split(",")[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            # BGR to RGB conversion
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb_frame)

            warnings = []

            # 2. Check: Multi-Face Detection
            if not results.multi_face_landmarks:
                warnings.append("NO FACE DETECTED")
            elif len(results.multi_face_landmarks) > 1:
                warnings.append("MULTIPLE FACES DETECTED")
            else:
                # 3. Check: Face Direction / Looking Away
                landmarks = results.multi_face_landmarks[0].landmark
                h, w, _ = frame.shape

                # Nose Tip and Eye Landmark Coordinates
                nose_x = landmarks[1].x * w
                left_eye_x = landmarks[33].x * w
                right_eye_x = landmarks[263].x * w

                # Center distance check
                eye_center_x = (left_eye_x + right_eye_x) / 2
                offset = nose_x - eye_center_x

                threshold = w * 0.05  # Sensitivity threshold

                if offset > threshold:
                    warnings.append("LOOKING RIGHT")
                elif offset < -threshold:
                    warnings.append("LOOKING LEFT")

            # 4. Result Send Karo
            await websocket.send_json({
                "face_count": len(results.multi_face_landmarks) if results.multi_face_landmarks else 0,
                "warnings": warnings
            })

    except WebSocketDisconnect:
        print("Client Disconnected")
    except Exception as e:
        print(f"Error: {e}")