import requests
import time
import json

def test_audio_access():
    """测试音频文件访问，模拟前端行为"""
    
    # 测试的音频文件URL
    audio_file = "a5de7b75-c986-4775-9c9a-12a7552f59cf.wav"
    base_url = "http://127.0.0.1:8000/outputs"
    
    print("=== 音频文件访问测试 ===")
    print(f"测试文件: {audio_file}")
    print(f"基础URL: {base_url}")
    print("=" * 50)
    
    # 测试1: 直接访问（无时间戳）
    print("\n1. 测试直接访问（无时间戳）")
    try:
        url = f"{base_url}/{audio_file}"
        print(f"请求URL: {url}")
        response = requests.get(url, timeout=10)
        print(f"状态码: {response.status_code}")
        print(f"内容类型: {response.headers.get('Content-Type')}")
        print(f"内容长度: {response.headers.get('Content-Length')}")
        print(f"ETag: {response.headers.get('ETag')}")
    except Exception as e:
        print(f"请求失败: {e}")
    
    # 测试2: 带时间戳访问（模拟前端）
    print("\n2. 测试带时间戳访问（模拟前端）")
    try:
        timestamp = int(time.time() * 1000)
        url = f"{base_url}/{audio_file}?t={timestamp}"
        print(f"请求URL: {url}")
        response = requests.get(url, timeout=10)
        print(f"状态码: {response.status_code}")
        print(f"内容类型: {response.headers.get('Content-Type')}")
        print(f"内容长度: {response.headers.get('Content-Length')}")
        print(f"ETag: {response.headers.get('ETag')}")
    except Exception as e:
        print(f"请求失败: {e}")
    
    # 测试3: 多次连续访问（模拟前端重复请求）
    print("\n3. 测试多次连续访问")
    for i in range(3):
        try:
            timestamp = int(time.time() * 1000) + i
            url = f"{base_url}/{audio_file}?t={timestamp}"
            print(f"第{i+1}次请求: {url}")
            response = requests.get(url, timeout=5)
            print(f"  状态码: {response.status_code}")
            print(f"  响应时间: {response.elapsed.total_seconds():.3f}秒")
            time.sleep(0.1)  # 短暂延迟
        except Exception as e:
            print(f"  请求失败: {e}")
    
    # 测试4: HEAD请求（检查文件是否存在）
    print("\n4. 测试HEAD请求（检查文件存在性）")
    try:
        url = f"{base_url}/{audio_file}"
        print(f"HEAD请求URL: {url}")
        response = requests.head(url, timeout=10)
        print(f"状态码: {response.status_code}")
        print(f"内容类型: {response.headers.get('Content-Type')}")
        print(f"内容长度: {response.headers.get('Content-Length')}")
        print(f"Last-Modified: {response.headers.get('Last-Modified')}")
    except Exception as e:
        print(f"HEAD请求失败: {e}")
    
    # 测试5: 检查服务器状态
    print("\n5. 检查服务器状态")
    try:
        url = "http://127.0.0.1:8000/"
        response = requests.get(url, timeout=5)
        print(f"服务器状态: {response.status_code}")
        print(f"服务器响应: {response.text}")
    except Exception as e:
        print(f"服务器检查失败: {e}")

if __name__ == "__main__":
    test_audio_access()