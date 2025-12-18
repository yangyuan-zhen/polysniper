# PolySniper 文档索引

## 🔥 快速链接

- **[价格获取失败调试](./DEBUG_PRICES.md)** - 为什么有些比赛拿不到价格？
- **[故障排除指南](./TROUBLESHOOTING.md)** - TLS错误、API超时问题
- **[信号策略说明](./SIGNALS_GUIDE.md)** - 理解买入/卖出信号

---

## 核心文档

### [CHANGELOG.md](./CHANGELOG.md) 
**项目更新日志**
- 版本重大更新记录
- 强队抄底策略
- 性能优化记录
- 未来版本计划
- **适合了解最新变化**

### 📖 [README.md](./README.md)
**项目概览与快速开始指南**
- 产品介绍与核心功能
- 安装和配置说明
- 技术栈介绍
- 快速开始教程
- **适合新用户**

### 📋 [PRD.md](./PRD.md)
**产品需求文档 (Product Requirements Document)**
- 产品定位与目标用户
- 核心功能需求详解
- REST API 价格更新方案
- 强队抄底策略说明
- ESPN胜率预测应用
- **适合产品经理和开发者**

### 📊 [SIGNALS_GUIDE.md](./SIGNALS_GUIDE.md)
**交易信号与策略详解**
- 比赛卡片颜色含义
- 5种交易信号类型（强买入/买入/强卖出/卖出/中性）
- 强队抄底策略详解
- ESPN胜率预测使用方法
- 核心策略逻辑说明
- 风险提示与使用建议
- **适合交易者和策略研究者**

## 技术文档

### 🔧 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 🆕
**故障排除指南**
- TLS连接错误解决方案
- API请求超时处理
- 虎扑API问题处理
- 性能优化建议
- **适合遇到错误的用户**

### 🐛 [DEBUG_PRICES.md](./DEBUG_PRICES.md)
**价格获取调试指南**
- 价格获取失败原因分析
- Polymarket API 调试方法
- **适合排查价格问题**

## 📑 文档快速导航

### 我是新用户，想快速了解项目
→ 阅读 [README.md](./README.md)

### 我想了解交易信号和策略
→ 阅读 [SIGNALS_GUIDE.md](./SIGNALS_GUIDE.md)

### 我想了解产品功能需求
→ 阅读 [PRD.md](./PRD.md)

### 遇到TLS连接错误或API超时
→ 阅读 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 完整的故障排除指南

### 价格获取有问题
→ 阅读 [DEBUG_PRICES.md](./DEBUG_PRICES.md) - 价格调试指南

### 我想自己开发类似功能
→ 依次阅读：
1. [PRD.md](./PRD.md) - 了解功能需求
2. [SIGNALS_GUIDE.md](./SIGNALS_GUIDE.md) - 了解策略逻辑
3. [README.md](./README.md) - 了解技术实现

## 🔑 关键功能一览

### 实时数据监控
- ✅ **REST API 价格轮询** - 45秒更新
- ✅ **请求队列控制** - 避免API过载
- ✅ **智能延迟机制** - 避免资源耗尽
- ✅ **比赛实时比分** - 10秒更新
- ✅ **ESPN胜率预测** - 赛前+赛中双显示

### 智能交易策略
- ✅ **强队抄底策略** - 基于赛前ESPN胜率判断
- ✅ **均值回归策略** - 价格偏离真实胜率时回归
- ✅ **波段交易策略** - 捕捉比赛中的价格波动
- ✅ **置信度评分** - 每个信号都有50-100%置信度
- ✅ **静音模式** - 提示音已禁用，UI显示信号

### 数据持久化
- ✅ **赛前胜率缓存** - localStorage永久保存
- ✅ **信号历史记录** - 完整记录所有交易信号
- ✅ **价格趋势图** - Chart.js可视化

## 🔧 环境配置

### 必需配置
```bash
# .env
HTTP_PROXY=http://127.0.0.1:7890     # Clash代理
HTTPS_PROXY=http://127.0.0.1:7890
```

## 📊 技术栈

### 前端
- React 18 + TypeScript
- Vite - 开发构建工具
- TailwindCSS - 样式框架
- Chart.js - 数据可视化

### 数据源
- Polymarket REST API - 价格数据（45秒轮询）
- 虎扑 API - NBA比赛数据（10秒更新）
- ESPN API - 胜率预测、伤病信息

### 核心算法
- 强队抄底策略 (Strong Team Dip Buying)
- 均值回归 (Mean Reversion)
- 波段交易 (Swing Trading)

## 🎯 项目特点

1. **专注NBA** - 仅支持Polymarket NBA市场
2. **更新及时** - REST API 45秒轮询，比分10秒更新
3. **策略智能** - 多因素综合分析（价格+比分+时间+胜率）
4. **持久化强** - 赛前胜率永久缓存
5. **系统简洁** - REST API 稳定可靠

## 📅 文档更新日志

- 2025-11-26: 清理项目 - 移除 WebSocket 相关代码和文档
- 2025-11-25: 创建 TROUBLESHOOTING.md - 故障排除指南
- 2025-11-25: 更新 CHANGELOG.md - API重试机制、胜率过滤
- 2025-11-25: 创建 DOCS_INDEX.md - 文档索引总览
- 2025-11-25: 更新 README.md - 强队抄底策略
- 2025-11-25: 更新 SIGNALS_GUIDE.md - 强队抄底详解、胜率门槛
- 2025-11-25: 更新 PRD.md - 赛前胜率缓存、胜率门槛

## ⚠️ 免责声明

本工具仅供学习和研究使用，不构成任何投资建议。
- 预测市场具有风险，交易需谨慎
- 信号算法基于历史数据，无法保证未来收益
- 建议小额测试，验证策略有效性后再增加投入
- 请遵守当地法律法规

---

📝 如有疑问，请查阅相应文档或提交 Issue
