# 后端接口

Python 入口为 `run.py`，默认监听 `5173`，前端接口路径与现有 Node 服务兼容。

- `GET /api/health`：健康检查
- `GET /api/session`：会话信息
- `GET /api/tasks/image`：图像题目
- `POST /api/answers/image`：提交 `{ "taskId": "image-q1", "optionId": "A" }`
- `GET /api/video/sample`：示例视频分析
- `POST /api/video/analyze`：提交 `{ "fileName": "demo.mp4" }`
- `GET /api/report`：综合报告
- `POST /api/session/reset`：清空演示会话答案

`src/model/emotion_model.py` 当前提供稳定的演示模型适配器；生产环境可替换为真实帧级/时序模型。
