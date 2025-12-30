// components/EyeController.ts
import { useEffect, useRef, useState } from 'react';

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
    const [eyeState, setEyeState] = useState<'open' | 'closed'>('open');
    const [blinkCount, setBlinkCount] = useState(0);
    const [earValue, setEarValue] = useState(0);
    const [threshold, setThreshold] = useState(0.3);
    const [fps, setFps] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const socketRef = useRef<WebSocket | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const frameIntervalRef = useRef<number>(100); // 每100ms发送一帧（10fps）

    // 初始化摄像头
    const initCamera = async () => {
        try {
            if (!enabled) return;

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'user'
                },
                audio: false
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            console.log('摄像头初始化成功');
            return true;
        } catch (err) {
            console.error('摄像头初始化失败:', err);
            setError('无法访问摄像头，请检查权限');
            return false;
        }
    };

    // 初始化WebSocket连接
    const connectWebSocket = () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            return true;
        }

        try {
            const socket = new WebSocket('ws://localhost:5000');

            socket.onopen = () => {
                console.log('WebSocket连接已建立');
                setIsConnected(true);
                setError(null);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    switch (data.event) {
                        case 'connected':
                            console.log('已连接到眨眼检测服务器');
                            break;

                        case 'calibration_complete':
                            setIsCalibrating(false);
                            setThreshold(data.threshold);
                            console.log('校准完成，阈值:', data.threshold);
                            break;

                        case 'eyes_closed':
                            setEyeState('closed');
                            onEyesClosed?.(data.duration || 0);
                            break;

                        case 'eyes_opened':
                            setEyeState('open');
                            onEyesOpened?.();
                            break;

                        case 'blink_detected':
                            setBlinkCount(data.count);
                            onBlink?.(data.count);
                            break;

                        case 'eye_data':
                            setEarValue(data.ear);
                            setEyeState(data.state);
                            setThreshold(data.threshold);
                            setFps(data.fps);
                            setIsCalibrating(data.calibrating);
                            break;

                        case 'error':
                            setError(data.message);
                            break;
                    }
                } catch (err) {
                    console.error('解析WebSocket消息失败:', err);
                }
            };

            socket.onerror = (err) => {
                console.error('WebSocket错误:', err);
                setError('WebSocket连接错误');
            };

            socket.onclose = () => {
                console.log('WebSocket连接已关闭');
                setIsConnected(false);
            };

            socketRef.current = socket;
            return true;
        } catch (err) {
            console.error('WebSocket连接失败:', err);
            setError('无法连接到眨眼检测服务器');
            return false;
        }
    };

    // 发送视频帧
    const sendFrame = () => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        if (!videoRef.current || !streamRef.current) {
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) return;

            canvas.width = 640;
            canvas.height = 480;

            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            // 压缩图像为JPEG
            canvas.toBlob((blob) => {
                if (blob && socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(blob);
                }
            }, 'image/jpeg', 0.7);

        } catch (err) {
            console.error('发送帧失败:', err);
        }
    };

    // 主循环
    const startFrameLoop = () => {
        if (!enabled || !isConnected) return;

        const loop = (timestamp: number) => {
            if (timestamp - lastFrameTimeRef.current >= frameIntervalRef.current) {
                sendFrame();
                lastFrameTimeRef.current = timestamp;
            }

            if (enabled && isConnected) {
                animationFrameRef.current = requestAnimationFrame(loop);
            }
        };

        animationFrameRef.current = requestAnimationFrame(loop);
    };

    // 停止所有资源
    const stop = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        setIsConnected(false);
    };

    // 开始检测
    const start = async () => {
        if (!enabled) return;

        setError(null);

        // 1. 初始化摄像头
        const cameraSuccess = await initCamera();
        if (!cameraSuccess) return;

        // 2. 连接WebSocket
        const socketSuccess = connectWebSocket();
        if (!socketSuccess) return;

        // 等待连接建立
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. 开始帧循环
        if (isConnected) {
            startFrameLoop();
        }
    };

    // 重置校准
    const resetCalibration = () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                event: 'reset_calibration'
            }));
            setIsCalibrating(true);
            setBlinkCount(0);
        }
    };

    // 组件挂载/卸载
    useEffect(() => {
        if (enabled) {
            start();
        }

        return () => {
            stop();
        };
    }, [enabled]);

    return {
        // 状态
        isConnected,
        isCalibrating,
        eyeState,
        blinkCount,
        earValue,
        threshold,
        fps,
        error,

        // 引用
        videoRef,

        // 方法
        start,
        stop,
        resetCalibration,

        // 控制
        enabled,

        // 手动触发（用于调试）
        triggerBlink: () => {
            setBlinkCount(prev => prev + 1);
            onBlink?.(blinkCount + 1);
        },
        triggerEyesClosed: () => {
            setEyeState('closed');
            onEyesClosed?.(0.5);
        },
        triggerEyesOpened: () => {
            setEyeState('open');
            onEyesOpened?.();
        }
    };
};