from __future__ import annotations

import argparse

from .model import CameraEmotionAnalyzer


def main() -> None:
    parser = argparse.ArgumentParser(description="OpenCV + DeepFace 实时摄像头表情检测")
    parser.add_argument("--target", help="当前视频对应的目标情绪，例如 开心、难过、害怕")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--duration", type=float, default=6.0)
    parser.add_argument("--no-display", action="store_true")
    args = parser.parse_args()
    result = CameraEmotionAnalyzer(args.camera).analyze_camera(
        target_emotion=args.target, duration_seconds=args.duration, display=not args.no_display
    )
    print(result.as_dict())


if __name__ == "__main__":
    main()
