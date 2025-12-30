import eventlet
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
from math import sqrt
import time
from datetime import datetime

# 启用 Eventlet 异步模式
eventlet.monkey_patch()

app = Flask(__name__)
CORS(app)
# async_mode='eventlet' 对于实时视频流至关重要
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# --- MediaPipe 初始化 ---
import mediapipe as mp
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True, # 关键：开启精细点位
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# 关键点索引
RIGHT_EYE = [33, 160, 158, 133, 153, 144]
LEFT_EYE = [362, 385, 387, 263, 373, 380]

class EyeStateDetector:
    def __init__(self):
        # 校准相关
        self.calibrating = True
        self.ratios = []
        self.min_ratio = float("inf")
        self.max_ratio = float("-inf")
        self.threshold = 0.25 # 默认初始阈值
        
        # 图像增强 (移植自 app_gray.py)
        # 即使在光线不好的情况下也能看清眼睛
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

        # 状态跟踪
        self.eye_state = "open"
        self.blink_counter = 0
        self.closed_start_time = None
        
        # 性能统计
        self.frame_count = 0
        self.fps = 0
        self.last_fps_time = time.time()

    def _calculate_ear(self, landmarks, eye_points):
        """
        计算 3D EAR (移植自 app_gray.py)
        使用 (x, y, z) 三维坐标计算，防止头部偏转导致的误判
        """
        def distance(p1, p2):
            return sqrt(
                (p2[0] - p1[0]) ** 2 + 
                (p2[1] - p1[1]) ** 2 + 
                (p2[2] - p1[2]) ** 2
            )

        # 垂直距离
        ver1 = distance(landmarks[eye_points[1]], landmarks[eye_points[5]])
        ver2 = distance(landmarks[eye_points[2]], landmarks[eye_points[4]])

        # 水平距离
        hor = distance(landmarks[eye_points[0]], landmarks[eye_points[3]])

        return (ver1 + ver2) / (2.0 * hor) if hor != 0 else 0

    def process_frame(self, frame):
        # 1. 计算 FPS
        self.frame_count += 1
        current_time = time.time()
        if current_time - self.last_fps_time >= 1.0:
            self.fps = self.frame_count
            self.frame_count = 0
            self.last_fps_time = current_time

        # 2. 图像增强 (移植自 app_gray.py)
        # 转灰度 -> 增强对比度 -> 转回 RGB
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = self.clahe.apply(gray)
        rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)

        results = face_mesh.process(rgb)
        
        # 3. 未检测到人脸的处理 (修复前端“一直校准中”的 Bug)
        if not results.multi_face_landmarks:
            socketio.start_background_task(
                lambda: socketio.emit("eye_data", {
                    "ear": 0,
                    "state": "no_face",   # 明确告知前端没脸
                    "threshold": self.threshold,
                    "fps": self.fps,
                    "calibrating": False  # 强制结束校准动画
                })
            )
            return

        for face_landmarks in results.multi_face_landmarks:
            # 获取 3D 坐标
            landmarks = [(lm.x, lm.y, lm.z) for lm in face_landmarks.landmark]
            left_ear = self._calculate_ear(landmarks, LEFT_EYE)
            right_ear = self._calculate_ear(landmarks, RIGHT_EYE)
            avg_ear = (left_ear + right_ear) / 2
            
            # --- 校准逻辑 ---
            if self.calibrating:
                self.min_ratio = min(self.min_ratio, avg_ear)
                self.max_ratio = max(self.max_ratio, avg_ear)
                self.ratios.append(avg_ear)
                socketio.start_background_task(
                    lambda: socketio.emit("eye_data", {
                        "ear": avg_ear,
                        "state": "calibrating",
                        "threshold": self.threshold,
                        "fps": self.fps,
                        "calibrating": True,
                        "calibration_progress": len(self.ratios) / 60  # 添加进度
                    })
                )
                # 采集 60 帧 (约 2-3 秒) 后自动完成校准
                if len(self.ratios) >= 60:
                    # 动态计算阈值：在最小闭眼值和最大睁眼值之间取 40% 处
                    # 例如：闭眼 0.15，睁眼 0.35 -> 阈值约 0.23
                    self.threshold = self.min_ratio + (self.max_ratio - self.min_ratio) * 0.4
                    self.calibrating = False
                    print(f"[系统] 校准完成，动态阈值: {self.threshold:.4f}")
                
                # 校准期间也发送数据，让前端能看到进度或数值
                socketio.start_background_task(
                    lambda: socketio.emit("calibration_complete", {
                        "threshold": self.threshold,
                        "min_ear": self.min_ratio,
                        "max_ear": self.max_ratio
                    })
                )
                return

            # --- 正常检测逻辑 ---
            current_state = "open"
            
            # 只有双眼同时低于阈值才算闭眼，防止单眼误判
            if left_ear < self.threshold and right_ear < self.threshold:
                current_state = "closed"
                if self.eye_state != "closed":
                    self.eye_state = "closed"
                    self.closed_start_time = time.time()
                    # 触发闭眼事件
                    socketio.start_background_task(
                        lambda: socketio.emit("eyes_closed", {
                            "timestamp": datetime.now().isoformat(),
                            "duration": 0
                        })
                    )
            else:
                # 眼睛睁开
                if self.eye_state == "closed":
                    # 计算闭眼持续时间
                    duration = time.time() - (self.closed_start_time or time.time())
                    self.eye_state = "open"
                    
                    # 只有非常短暂的闭合才算眨眼，太长算“闭目养神”
                    # 这里不做过多限制，由前端逻辑决定
                    self.blink_counter += 1
                    
                    socketio.start_background_task(
                        lambda: socketio.emit("blink_detected", {
                            "count": self.blink_counter,
                            "timestamp": datetime.now().isoformat(),
                            "duration": duration
                        })
                    )

            # --- 发送实时数据流 ---
            socketio.start_background_task(
                lambda: socketio.emit("eye_data", {
                    "ear": avg_ear,
                    "state": current_state,
                    "threshold": self.threshold,
                    "fps": self.fps,
                    "calibrating": False
                })
            )

# 全局单例
detector = EyeStateDetector()

@socketio.on("frame")
def handle_frame(data):
    """
    处理前端发来的 Blob 数据
    """
    try:
        if not data:
            return

        # 健壮性处理：兼容 Blob (bytes) 和 file-like object
        if hasattr(data, "read"):
            image_data = data.read()
        else:
            image_data = data
        # 解码图片
        img = Image.open(BytesIO(image_data))
        # 转换为 OpenCV 格式 (BGR)
        frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        # 处理
        detector.process_frame(frame)
    except Exception as e:
        # 打印错误，但不让服务器崩溃
        print(f"[ERROR] Frame processing error: {e}")

@app.route("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    print("启动眨眼检测服务器 (Optimized)...")
    print("地址: http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, use_reloader=False)