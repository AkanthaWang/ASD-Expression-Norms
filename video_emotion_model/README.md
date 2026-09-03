# 实时视频表情识别模型

本目录是独立的视频检测模块，不读取或分析 `data/videos` 中的视频文件。它只采集实时摄像头画面：OpenCV 负责摄像头读取和抽帧，DeepFace 负责逐帧表情分类，最后用时间窗口内出现次数最多的情绪作为结果，并与当前任务传入的目标情绪比较。

## 安装

```bash
pip install -r video_emotion_model/requirements.txt
```

首次调用 DeepFace 可能自动下载其人脸检测/表情模型权重。

## 命令行测试

视频播放到需要检测的阶段时，可在另一个终端运行：

```bash
python -m video_emotion_model.cli --target 开心 --duration 6
```

按 `q` 可提前结束。无窗口环境可加 `--no-display`。输出字段包括识别情绪、平均置信度、分析帧数、各情绪计数和 `isMatch`。

## Python 接口

```python
from video_emotion_model import CameraEmotionAnalyzer

result = CameraEmotionAnalyzer().analyze_camera(target_emotion="难过")
print(result.as_dict())
```

`target_emotion` 应传入当前视频的目标情绪（如“开心”“难过”“害怕”）。模块不会把摄像头录像保存到磁盘，也不会上传外部服务。
