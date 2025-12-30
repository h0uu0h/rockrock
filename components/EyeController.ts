// components/EyeController.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface EyeControllerProps {
    onEyesClosed?: (duration: number) => void;
    onEyesOpened?: () => void;
    onBlink?: (blinkCount: number) => void;
    enabled?: boolean;
}

export const useEyeController = (props?: EyeControllerProps) => {
    const {
        onEyesClosed,
        onEyesOpened,
        onBlink,
        enabled = true
    } = props || {};

    const [isConnected, setIsConnected] = useState(false);
    const [isCalibrating, setIsCalibrating] = useState(true);
    const [eyeState, setEyeState] = useState<'open' | 'closed' | 'no_face'>('open');
    const [blinkCount, setBlinkCount] = useState(0);
    const [earValue, setEarValue] = useState(0);
    const [fps, setFps] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);

    // 限制发送频率为 15 FPS (约 66ms)，平衡性能与实时性
    const frameIntervalRef = useRef<number>(66);

    const initCamera = async () => {
        try {
            if (!enabled) return false;
            // 停止旧流
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            // 获取摄像头流
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 320, // 低分辨率足够检测，且传输极快
                    height: 240,
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                },
                audio: false
            });

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // 确保视频已经准备好播放
                await new Promise((resolve) => {
                    if (videoRef.current) {
                        videoRef.current.onloadedmetadata = () => {
                            videoRef.current?.play().then(resolve);
                        };
                    }
                });
            }
            return true;
        } catch (err) {
            console.error('摄像头初始化失败:', err);
            setError('无法访问摄像头，请检查权限。');
            return false;
        }
    };

    const connectSocket = () => {
        if (socketRef.current?.connected) return;

        const socket = io('http://localhost:5000', {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10
        });

        socket.on('connect', () => {
            console.log('Socket已连接:', socket.id);
            setIsConnected(true);
            setError(null);
        });

        socket.on('disconnect', () => {
            console.log('Socket已断开');
            setIsConnected(false);
        });

        socket.on('connect_error', (err) => {
            console.error('Socket连接错误:', err);
            // 不频繁报错，以免刷屏
        });
        socket.on('calibration_complete', (data) => {
            console.log('校准完成，阈值:', data.threshold);
            setIsCalibrating(false);
            setError(null); // 清除可能的错误
        });

        // --- 核心事件监听 ---

        socket.on('blink_detected', (data) => {
            setBlinkCount(data.count);
            onBlink?.(data.count);
        });

        socket.on('eyes_closed', (data) => {
            // 只在状态改变时触发
            setEyeState('closed');
            onEyesClosed?.(data.duration || 0);
        });

        socket.on('eye_data', (data) => {
            // 只要收到数据，就说明已经通了，关闭校准（除非后端显式说正在 calibrating）
            if (data.calibrating === true || data.state === 'calibrating') {
                setIsCalibrating(true);
            } else {
                setIsCalibrating(false);
            }

            // 处理无脸状态
            if (data.state === 'no_face') {
                setEyeState('no_face');
                setEarValue(0); // 归零EAR
                setFps(data.fps);
                return;
            }

            setEarValue(data.ear);
            setEyeState(data.state);
            setFps(data.fps);

            // 如果后端检测到睁眼，且当前状态不是 open，触发回调
            if (data.state === 'open' && eyeState !== 'open') {
                onEyesOpened?.();
            }
        });

        socketRef.current = socket;
    };

    const sendFrame = () => {
        if (!socketRef.current?.connected || !videoRef.current) return;

        // 创建临时 Canvas 截取视频帧
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 绘制当前帧
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        // 转为 Blob 并直接发送
        canvas.toBlob((blob) => {
            if (blob) {
                // Socket.IO 可以直接发送 Blob 二进制数据
                socketRef.current?.emit('frame', blob);
            }
        }, 'image/jpeg', 0.5); // 0.5 质量压缩，极速传输
    };

    const startFrameLoop = () => {
        const loop = (timestamp: number) => {
            if (!enabled) return;

            if (timestamp - lastFrameTimeRef.current >= frameIntervalRef.current) {
                sendFrame();
                lastFrameTimeRef.current = timestamp;
            }
            animationFrameRef.current = requestAnimationFrame(loop);
        };
        animationFrameRef.current = requestAnimationFrame(loop);
    };

    const start = async () => {
        if (!enabled) return;
        const cameraOk = await initCamera();
        if (cameraOk) {
            connectSocket();
            startFrameLoop();
        }
    };

    const stop = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        setIsConnected(false);
    };

    useEffect(() => {
        if (enabled) {
            start();
        } else {
            stop();
        }
        return () => stop();
    }, [enabled]);

    return {
        isConnected,
        isCalibrating,
        eyeState,
        blinkCount,
        earValue,
        fps,
        error,
        videoRef,
        start,
        stop,
        triggerBlink: () => onBlink?.(blinkCount + 1),
    };
};