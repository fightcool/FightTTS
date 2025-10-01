#!/usr/bin/env python3
"""
创建测试音频文件
"""

import numpy as np
import wave
import struct

def create_test_audio(filename="test_audio.wav", duration=2.0, sample_rate=22050):
    """创建一个简单的测试音频文件"""
    
    # 生成一个简单的正弦波
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    frequency = 440  # A4音符
    audio_data = np.sin(2 * np.pi * frequency * t) * 0.3  # 降低音量
    
    # 转换为16位整数
    audio_data = (audio_data * 32767).astype(np.int16)
    
    # 写入WAV文件
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # 单声道
        wav_file.setsampwidth(2)  # 16位
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())
    
    print(f"✅ 创建测试音频文件: {filename}")
    print(f"   时长: {duration}秒")
    print(f"   采样率: {sample_rate}Hz")
    print(f"   文件大小: {len(audio_data) * 2} bytes")

if __name__ == "__main__":
    create_test_audio()