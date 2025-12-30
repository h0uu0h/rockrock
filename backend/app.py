import eventlet
from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
from math import sqrt
import time
import json
import os
import uuid
from datetime import datetime

eventlet.monkey_patch()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# Initialize MediaPipe
import mediapipe as mp

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# 眼睛关键点索引
RIGHT_EYE = [33, 160, 158, 133, 153, 144]
LEFT_EYE = [362, 385, 387, 263, 373, 380]


class EyeStateDetector:
    def __init__(self):
        # 眨眼检测相关变量
        self.calibrating = True
        self.ratios = []
        self.min_ratio = float("inf")
        self.max_ratio = float("-inf")
        self.threshold = 0.3
        self.calibration_samples = 30  # 减少校准样本数，加快校准

        # 眼睛状态跟踪
        self.eye_state = "open"  # open, closed
        self.closed_start_time = None
        self.last_blink_time = None
        
        # 状态变化计数器
        self.blink_count = 0
        self.eyes_closed_duration = 0
        self.eyes_open_duration = 0
        
        # 平滑滤波
        self.ear_history = []
        self.history_size = 5
        self.smoothed_ear = 0
        
        # 性能跟踪
        self.frame_count = 0
        self.fps = 0
        self.last_fps_time = time.time()
        
        # 连接状态
        self.connected_clients = 0

    def _calculate_ear(self, landmarks, eye_points):
        """计算眼睛纵横比(EAR)"""
        def distance(p1, p2):
            return sqrt(
                (p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2
            )

        # 垂直距离
        ver1 = distance(landmarks[eye_points[1]], landmarks[eye_points[5]])
        ver2 = distance(landmarks[eye_points[2]], landmarks[eye_points[4]])

        # 水平距离
        hor = distance(landmarks[eye_points[0]], landmarks[eye_points[3]])

        return (ver1 + ver2) / (2.0 * hor) if hor != 0 else 0

    def _smooth_ear(self, current_ear):
        """平滑EAR值，减少抖动"""
        self.ear_history.append(current_ear)
        if len(self.ear_history) > self.history_size:
            self.ear_history.pop(0)
        return sum(self.ear_history) / len(self.ear_history)

    def calibrate(self, avg_ear):
        """执行校准"""
        self.min_ratio = min(self.min_ratio, avg_ear)
        self.max_ratio = max(self.max_ratio, avg_ear)
        self.ratios.append(avg_ear)

        if len(self.ratios) >= self.calibration_samples:
            # 动态阈值设置：眼睛闭合时EAR的70%位置
            self.threshold = self.min_ratio + (self.max_ratio - self.min_ratio) * 0.7
            self.calibrating = False
            print(f"校准完成！阈值: {self.threshold:.4f}")
            print(f"最小EAR: {self.min_ratio:.4f}, 最大EAR: {self.max_ratio:.4f}")
            return True
        return False

    def detect_eye_state(self, avg_ear):
        """检测眼睛状态"""
        # 平滑EAR值
        smoothed_ear = self._smooth_ear(avg_ear)
        self.smoothed_ear = smoothed_ear
        
        current_time = time.time()
        
        # 校准阶段
        if self.calibrating:
            is_calibrated = self.calibrate(smoothed_ear)
            if is_calibrated:
                socketio.start_background_task(
                    lambda: socketio.emit("calibration_complete", {
                        "threshold": self.threshold,
                        "min_ear": self.min_ratio,
                        "max_ear": self.max_ratio
                    })
                )
            return {"status": "calibrating", "progress": len(self.ratios) / self.calibration_samples}

        # 检测眼睛状态
        if smoothed_ear < self.threshold:
            # 眼睛闭合
            if self.eye_state != "closed":
                self.eye_state = "closed"
                self.closed_start_time = current_time
                
                # 发送闭眼事件
                socketio.start_background_task(
                    lambda: socketio.emit("eyes_closed", {
                        "timestamp": datetime.now().isoformat(),
                        "ear": smoothed_ear
                    })
                )
                
            # 计算闭眼时长
            if self.closed_start_time:
                closed_duration = current_time - self.closed_start_time
                self.eyes_closed_duration = closed_duration
                
        else:
            # 眼睛睁开
            if self.eye_state == "closed":
                # 从闭眼到睁开：检测到眨眼
                blink_duration = 0
                if self.closed_start_time:
                    blink_duration = current_time - self.closed_start_time
                
                self.eye_state = "open"
                self.last_blink_time = current_time
                self.blink_count += 1
                
                # 发送眨眼事件
                socketio.start_background_task(
                    lambda: socketio.emit("blink_detected", {
                        "timestamp": datetime.now().isoformat(),
                        "count": self.blink_count,
                        "duration": blink_duration,
                        "ear": smoothed_ear
                    })
                )
                
                # 重置闭眼时间
                self.closed_start_time = None
                self.eyes_closed_duration = 0
            
            # 计算睁眼时长
            if self.last_blink_time:
                self.eyes_open_duration = current_time - self.last_blink_time

        return {
            "state": self.eye_state,
            "ear": smoothed_ear,
            "threshold": self.threshold,
            "blink_count": self.blink_count,
            "eyes_closed_duration": self.eyes_closed_duration,
            "eyes_open_duration": self.eyes_open_duration
        }

    def reset(self):
        """重置检测器状态"""
        self.calibrating = True
        self.ratios = []
        self.min_ratio = float("inf")
        self.max_ratio = float("-inf")
        self.eye_state = "open"
        self.closed_start_time = None
        self.last_blink_time = None
        self.blink_count = 0
        self.eyes_closed_duration = 0
        self.eyes_open_duration = 0
        self.ear_history = []

    def process_frame(self, frame):
        """处理视频帧"""
        # 更新FPS
        self.frame_count += 1
        current_time = time.time()
        if current_time - self.last_fps_time >= 1.0:
            self.fps = self.frame_count
            self.frame_count = 0
            self.last_fps_time = current_time
        
        # 图像预处理
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)

        results = face_mesh.process(rgb)
        if not results.multi_face_landmarks:
            # 没有检测到人脸，重置状态
            if self.eye_state != "open":
                self.eye_state = "open"
                self.closed_start_time = None
                socketio.start_background_task(
                    lambda: socketio.emit("eyes_opened", {
                        "timestamp": datetime.now().isoformat(),
                        "reason": "no_face_detected"
                    })
                )
            return {"status": "no_face_detected"}

        for face_landmarks in results.multi_face_landmarks:
            landmarks = [(lm.x, lm.y) for lm in face_landmarks.landmark]
            left_ear = self._calculate_ear(landmarks, LEFT_EYE)
            right_ear = self._calculate_ear(landmarks, RIGHT_EYE)
            avg_ear = (left_ear + right_ear) / 2
            
            # 检测眼睛状态
            detection_result = self.detect_eye_state(avg_ear)
            
            # 发送实时数据
            socketio.start_background_task(
                lambda: socketio.emit("eye_data", {
                    "timestamp": datetime.now().isoformat(),
                    "ear": avg_ear,
                    "left_ear": left_ear,
                    "right_ear": right_ear,
                    "state": self.eye_state,
                    "threshold": self.threshold,
                    "fps": self.fps,
                    "calibrating": self.calibrating
                })
            )
            
            return detection_result
        
        return {"status": "processing_failed"}


# 全局检测器实例
detector = EyeStateDetector()


@socketio.on("connect")
def handle_connect():
    """客户端连接时触发"""
    global detector
    detector.connected_clients += 1
    print(f"客户端已连接，当前连接数: {detector.connected_clients}")
    
    # 发送连接确认
    socketio.emit("connected", {
        "status": "connected",
        "message": "欢迎使用眨眼检测系统",
        "calibration_required": detector.calibrating
    })


@socketio.on("disconnect")
def handle_disconnect():
    """客户端断开时触发"""
    global detector
    detector.connected_clients -= 1
    print(f"客户端已断开，剩余连接数: {detector.connected_clients}")


@socketio.on("reset_calibration")
def handle_reset_calibration():
    """重置校准"""
    detector.reset()
    print("校准已重置")
    return {"status": "calibration_reset"}


@socketio.on("frame")
def handle_frame(data):
    """处理视频帧"""
    try:
        # 解析图像数据
        if hasattr(data, "read"):
            image_data = data.read()
        else:
            image_data = data
        
        # 解码图像
        img = Image.open(BytesIO(image_data))
        frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        
        # 处理帧
        result = detector.process_frame(frame)
        
        # 返回处理结果
        return result
        
    except Exception as e:
        print(f"[ERROR] 帧处理失败: {e}")
        socketio.start_background_task(
            lambda: socketio.emit("error", {
                "message": f"帧处理失败: {str(e)}",
                "timestamp": datetime.now().isoformat()
            })
        )
        return {"status": "error", "message": str(e)}


@socketio.on("get_status")
def handle_get_status():
    """获取当前状态"""
    return {
        "calibrating": detector.calibrating,
        "eye_state": detector.eye_state,
        "blink_count": detector.blink_count,
        "threshold": detector.threshold,
        "connected_clients": detector.connected_clients,
        "fps": detector.fps
    }


@app.route("/health", methods=["GET"])
def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "clients": detector.connected_clients,
        "calibrated": not detector.calibrating
    }


if __name__ == "__main__":
    print("启动眨眼检测服务器...")
    print("服务地址: http://0.0.0.0:5000")
    print("WebSocket地址: ws://0.0.0.0:5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, use_reloader=False)