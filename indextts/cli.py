import os
import sys
import warnings
# Suppress warnings from tensorflow and other libraries
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
def main():
    import argparse
    parser = argparse.ArgumentParser(description="IndexTTS Command Line")
    parser.add_argument("text", type=str, help="Text to be synthesized")
    parser.add_argument("-v", "--voice", type=str, required=True, help="Path to the audio prompt file (wav format)")
    parser.add_argument("-o", "--output_path", type=str, default="gen.wav", help="Path to the output wav file")
    parser.add_argument("-c", "--config", type=str, default="checkpoints/config.yaml", help="Path to the config file. Default is 'checkpoints/config.yaml'")
    parser.add_argument("--model_dir", type=str, default="checkpoints", help="Path to the model directory. Default is 'checkpoints'")
    parser.add_argument("--fp16", action="store_true", default=False, help="Use FP16 for inference if available")
    parser.add_argument("-f", "--force", action="store_true", default=False, help="Force to overwrite the output file if it exists")
    parser.add_argument("-d", "--device", type=str, default=None, help="Device to run the model on (cpu, cuda, mps, xpu)." )

    # 新增IndexTTS2相关参数
    parser.add_argument("--version", type=str, choices=["1", "2"], default="2", help="IndexTTS version to use (default: 2)")
    parser.add_argument("--emo_audio", type=str, default=None, help="Path to emotional reference audio file (IndexTTS2 only)")
    parser.add_argument("--emo_alpha", type=float, default=1.0, help="Emotional intensity control (0.0-1.0, IndexTTS2 only)")
    parser.add_argument("--use_random", action="store_true", default=False, help="Enable random sampling (IndexTTS2 only)")
    parser.add_argument("--temperature", type=float, default=0.8, help="Sampling temperature (IndexTTS2 only)")
    parser.add_argument("--top_p", type=float, default=0.8, help="Top-p sampling parameter (IndexTTS2 only)")
    parser.add_argument("--top_k", type=int, default=30, help="Top-k sampling parameter (IndexTTS2 only)")

    args = parser.parse_args()
    if len(args.text.strip()) == 0:
        print("ERROR: Text is empty.")
        parser.print_help()
        sys.exit(1)
    if not os.path.exists(args.voice):
        print(f"Audio prompt file {args.voice} does not exist.")
        parser.print_help()
        sys.exit(1)
    if not os.path.exists(args.config):
        print(f"Config file {args.config} does not exist.")
        parser.print_help()
        sys.exit(1)

    output_path = args.output_path
    if os.path.exists(output_path):
        if not args.force:
            print(f"ERROR: Output file {output_path} already exists. Use --force to overwrite.")
            parser.print_help()
            sys.exit(1)
        else:
            os.remove(output_path)

    try:
        import torch
    except ImportError:
        print("ERROR: PyTorch is not installed. Please install it first.")
        sys.exit(1)

    if args.device is None:
        if torch.cuda.is_available():
            args.device = "cuda:0"
        elif hasattr(torch, "xpu") and torch.xpu.is_available():
            args.device = "xpu"
        elif hasattr(torch, "mps") and torch.mps.is_available():
            args.device = "mps"
        else:
            args.device = "cpu"
            args.fp16 = False # Disable FP16 on CPU
            print("WARNING: Running on CPU may be slow.")

    # 根据版本选择对应的TTS引擎
    if args.version == "2":
        print(f"🎯 Using IndexTTS2 (version {args.version})")
        try:
            from indextts.infer_v2 import IndexTTS2
            tts = IndexTTS2(
                cfg_path=args.config,
                model_dir=args.model_dir,
                use_fp16=args.fp16,
                device=args.device
            )

            # 构建IndexTTS2推理参数
            infer_kwargs = {
                'spk_audio_prompt': args.voice,
                'text': args.text.strip(),
                'output_path': output_path,
                'verbose': True
            }

            # 添加可选参数
            if args.emo_audio and os.path.exists(args.emo_audio):
                infer_kwargs['emo_audio_prompt'] = args.emo_audio
                print(f"📢 Using emotional reference: {args.emo_audio}")

            if args.emo_alpha != 1.0:
                infer_kwargs['emo_alpha'] = args.emo_alpha
                print(f"🎭 Emotional intensity: {args.emo_alpha}")

            if args.use_random:
                infer_kwargs['use_random'] = True
                print("🎲 Random sampling enabled")

            # 执行推理
            print(f"🚀 Starting synthesis...")
            print(f"   Text: {args.text[:50]}{'...' if len(args.text) > 50 else ''}")
            print(f"   Voice: {args.voice}")
            print(f"   Output: {output_path}")

            tts.infer(**infer_kwargs)

            # 验证输出
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                print(f"✅ Synthesis completed successfully!")
                print(f"   Output file: {output_path}")
                print(f"   File size: {file_size} bytes")
            else:
                print("❌ ERROR: Synthesis failed - output file not generated.")
                sys.exit(1)

        except ImportError as e:
            print(f"ERROR: Failed to import IndexTTS2: {e}")
            print("Please ensure IndexTTS2 dependencies are properly installed.")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR: IndexTTS2 synthesis failed: {e}")
            sys.exit(1)
    else:
        print(f"🎯 Using IndexTTS1 (version {args.version})")
        # 原有的IndexTTS1代码
        from indextts.infer import IndexTTS
        tts = IndexTTS(cfg_path=args.config, model_dir=args.model_dir, use_fp16=args.fp16, device=args.device)
        tts.infer(audio_prompt=args.voice, text=args.text.strip(), output_path=output_path)

if __name__ == "__main__":
    main()