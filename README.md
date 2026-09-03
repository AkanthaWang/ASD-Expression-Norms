# 孤独症儿童表情识别常模

这是一个前后端分离的评估网页原型。前端采用原生 HTML/CSS/JavaScript，后端同时提供 Node.js 和 Python 两个兼容入口；Python 版本按研究型项目目录拆分，默认只使用标准库。

## 启动

```bash
# Node.js 入口
npm start

# Python 入口（推荐用于模型模块扩展）
python run.py
```

默认地址：`http://localhost:5173/`。也可以通过 `PORT=5174`（Windows PowerShell 使用 `$env:PORT=5174`）切换端口。

## 数据接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/health` | 服务健康检查 |
| GET | `/api/session` | 获取当前儿童会话和任务进度 |
| GET | `/api/tasks/image` | 获取图像识别题目及候选图片 |
| POST | `/api/answers/image` | 提交图像选项，返回正确性、得分和反馈 |
| GET | `/api/video/sample` | 获取示例视频模型分析结果 |
| POST | `/api/video/analyze` | 提交视频元信息，返回模型分析结果（当前为演示模型占位） |
| GET | `/api/report` | 获取综合评分、结论和线索 |
| POST | `/api/session/reset` | 重置当前演示会话 |

接口返回 JSON，并允许跨域请求。Node.js 的 `server.js` 与 Python 的 `run.py` / `src/api_server.py` 使用相同接口路径，前端无需切换配置。当前状态保存在内存中，重启后会清空。

## 目录结构

```text
ASD-Expression-Norms/
├── README.md
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── lucide.js
├── data/
│   ├── images/
│   ├── videos/
│   └── annotations/
├── src/
│   ├── image_task/
│   ├── video_task/
│   ├── model/
│   ├── evaluation/
│   ├── report/
│   └── api_server.py
├── notebooks/
├── requirements.txt
├── run.py
└── docs/
```

## 真实模型接入建议

1. 将 `src/model/emotion_model.py` 的演示适配器替换为文件存储、视频抽帧和时序模型调用。
2. 将 `src/image_task/`、`src/evaluation/` 的内存状态替换为持久化数据访问层。
3. 在接口层增加鉴权、儿童隐私保护、操作审计和脱敏日志。
4. 将图像 URL 改为经过授权的标准化情绪数据集资源，并保存标注版本。
