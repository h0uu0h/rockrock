import eventlet
# Windows下如果摄像头卡住，尝试注释掉下面这行
eventlet.monkey_patch()

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
import cv2
import numpy as np
from math import sqrt
import time

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

CAMERA_INDEX = 0

import mediapipe as mp
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

RIGHT_EYE = [33, 160, 158, 133, 153, 144]
LEFT_EYE = [362, 385, 387, 263, 373, 380]

class Detector:
    def __init__(self):
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        self.threshold = 0.3
        
        # === 核心状态变量 ===
        self.closed_frames = 0        # 连续闭眼帧数计数器
        self.is_moving_mode = False   # 标记当前是否已经进入了“移动模式”（即闭眼超过阈值）
        self.TRIGGER_THRESHOLD = 15   # 触发移动的阈值 (约0.5秒)

    def _calculate_ear(self, landmarks, eye_points):
        def distance(p1, p2):
            return sqrt((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2 + (p2[2]-p1[2])**2)
        ver1 = distance(landmarks[eye_points[1]], landmarks[eye_points[5]])
        ver2 = distance(landmarks[eye_points[2]], landmarks[eye_points[4]])
        hor = distance(landmarks[eye_points[0]], landmarks[eye_points[3]])
        return (ver1 + ver2) / (2.0 * hor) if hor != 0 else 0

    def process_frame(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = self.clahe.apply(gray)
        rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
        results = face_mesh.process(rgb)
        
        if not results.multi_face_landmarks:
            self.closed_frames = 0
            self.is_moving_mode = False
            return

        for face_landmarks in results.multi_face_landmarks:
            landmarks = [(lm.x, lm.y, lm.z) for lm in face_landmarks.landmark]
            left_ear = self._calculate_ear(landmarks, LEFT_EYE)
            right_ear = self._calculate_ear(landmarks, RIGHT_EYE)
            
            # 判断当前帧是否闭眼
            is_closed = (left_ear < self.threshold) and (right_ear < self.threshold)

            if is_closed:
                self.closed_frames += 1
                
                # === 逻辑分支 1：闭眼刚达到阈值 ===
                # 只有在正好第 15 帧的时候触发一次 start
                if self.closed_frames == self.TRIGGER_THRESHOLD:
                    self.is_moving_mode = True
                    print(">>> 闭眼蓄力完成，开始移动 (Start)")
                    socketio.emit('eye_closed', {'type': 'start', 'timestamp': time.time()})
                
            else:
                # === 逻辑分支 2：眼睛睁开了 ===
                
                # 情况 A：如果之前是“移动模式”（闭眼很久了）
                if self.is_moving_mode:
                    print("<<< 停止移动 (End)")
                    socketio.emit('eye_closed', {'type': 'end', 'timestamp': time.time()})
                    self.is_moving_mode = False
                    # 注意：这里不需要发 blink，因为长按通常意味着只是想移动，不想触发抽卡
                
                # 情况 B：如果之前闭眼时间很短（没达到移动阈值），但超过了防抖阈值（例如2帧）
                # 这就是一次标准的“眨眼”
                elif 2 < self.closed_frames < self.TRIGGER_THRESHOLD:
                    # 只有在非移动模式下，才算作眨眼交互
                    print(f"!!! 检测到眨眼 (帧数: {self.closed_frames})，触发交互")
                    socketio.emit('blink', {
                        'total_blinks': 0, # 这里前端不太用total_blinks，可以传0或自行维护计数
                        'duration_frames': self.closed_frames,
                        'timestamp': time.time()
                    })

                # 重置计数器
                self.closed_frames = 0

detector = Detector()

def camera_loop():
    print(f"正在初始化摄像头 (Index {CAMERA_INDEX})...")
    eventlet.sleep(1) 
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print("【错误】无法打开摄像头！")
        return
    print("【成功】摄像头运行中...")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            eventlet.sleep(1)
            continue
        try:
            detector.process_frame(frame)
        except Exception as e:
            print(f"检测出错: {e}")
        eventlet.sleep(0.03)

@socketio.on('connect')
def handle_connect():
    print('前端客户端已连接')

if __name__ == '__main__':
    socketio.start_background_task(camera_loop)
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)