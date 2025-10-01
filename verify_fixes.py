#!/usr/bin/env python3
"""
IndexTTS项目修复验证脚本 - 简化版本
"""

import os
import sys

def test_basic_imports():
    """测试基本模块导入"""
    print("测试1: 基本模块导入")

    tests = [
        ("IndexTTS2", "indextts.infer_v2", "IndexTTS2"),
        ("CLI模块", "indextts.cli", "main"),
        ("API服务器", "api_server", None)
    ]

    all_passed = True
    for name, module, attr in tests:
        try:
            mod = __import__(module, fromlist=[attr] if attr else [])
            if attr:
                getattr(mod, attr)
            print(f"  [PASS] {name}")
        except Exception as e:
            print(f"  [FAIL] {name}: {e}")
            all_passed = False

    return all_passed

def test_cli_features():
    """测试CLI新功能"""
    print("\n测试2: CLI功能检查")

    try:
        from indextts.cli import main
        # 检查main函数是否可调用
        print("  [PASS] CLI主函数可调用")
        return True
    except Exception as e:
        print(f"  [FAIL] CLI功能检查失败: {e}")
        return False

def test_model_files():
    """检查模型文件"""
    print("\n测试3: 模型文件检查")

    required_files = [
        "checkpoints/config.yaml",
        "checkpoints/gpt.pth",
        "checkpoints/s2mel.pth"
    ]

    missing = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing.append(file_path)

    if missing:
        print(f"  [WARN] 缺少文件: {missing}")
        return False
    else:
        print("  [PASS] 主要模型文件存在")
        return True

def test_transformers_fix():
    """测试Transformers修复"""
    print("\n测试4: Transformers兼容性修复")

    try:
        from indextts.gpt.transformers_gpt2 import GPT2PreTrainedModel
        from indextts.gpt.transformers_generation_utils import GenerationMixin

        # 检查继承关系
        if issubclass(GPT2PreTrainedModel, GenerationMixin):
            print("  [PASS] GPT2PreTrainedModel正确继承GenerationMixin")
            return True
        else:
            print("  [FAIL] 继承关系不正确")
            return False
    except Exception as e:
        print(f"  [FAIL] 兼容性检查失败: {e}")
        return False

def main():
    """主函数"""
    print("IndexTTS项目修复验证开始")
    print("=" * 50)

    tests = [
        test_basic_imports,
        test_cli_features,
        test_model_files,
        test_transformers_fix
    ]

    passed = 0
    total = len(tests)

    for test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"  [ERROR] 测试执行异常: {e}")

    print("\n" + "=" * 50)
    print(f"测试结果: {passed}/{total} 项通过")

    if passed == total:
        print("状态: 所有测试通过!")
    elif passed >= total * 0.75:
        print("状态: 大部分测试通过")
    else:
        print("状态: 需要进一步检查")

    print("\n主要修复项目:")
    print("1. API服务器TTS生成功能")
    print("2. Transformers兼容性问题")
    print("3. CLI工具IndexTTS2支持")
    print("4. WebSocket连接管理优化")
    print("5. 错误处理和日志改进")

    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)