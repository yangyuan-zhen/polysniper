# 🔍 价格获取失败调试指南

## 问题：有些比赛拿不到价格

### 可能的原因

#### 1. **Polymarket上没有这场比赛** ❌
Polymarket不是所有NBA比赛都有市场，通常只有：
- 热门球队比赛（湖人、勇士、凯尔特人等）
- 季后赛比赛
- 全国转播的比赛

**解决方案**：无法解决，等待Polymarket开盘

---

#### 2. **队伍名称翻译不匹配** 🔤
虎扑的中文队名可能与Polymarket的英文队名不匹配。

**检查方法**：
打开浏览器控制台（F12），查找警告：
```
⚠️ 无法获取价格: 某队 vs 某队
   可能原因:
   2. 队伍名称翻译不匹配 (中文: XXX, XXX)
```

**当前支持的队伍名称**：
```typescript
'凯尔特人' → 'Celtics'
'快船' → 'Clippers'
'马刺' → 'Spurs'
'国王' → 'Kings'
'奇才' → 'Wizards'
'篮网' → 'Nets'
'火箭' → 'Rockets'
'魔术' → 'Magic'
'鹈鹕' → 'Pelicans'
'勇士' → 'Warriors'
'独行侠' → 'Mavericks'
'开拓者' → 'Trail Blazers'
'爵士' → 'Jazz'
'公牛' → 'Bulls'
'太阳' → 'Suns'
'老鹰' → 'Hawks'
'活塞' → 'Pistons'
'步行者' → 'Pacers'
'76人' → '76ers'
'骑士' → 'Cavaliers'
'猛龙' → 'Raptors'
'黄蜂' → 'Hornets'
'热火' → 'Heat'
'尼克斯' → 'Knicks'
'森林狼' → 'Timberwolves'
'雷霆' → 'Thunder'
'掘金' → 'Nuggets'
'灰熊' → 'Grizzlies'
'湖人' → 'Lakers'
'雄鹿' → 'Bucks'
```

**如果队伍不在列表中**：
编辑 `src/services/polymarket.ts` 的 `TEAM_NAME_MAP`，添加新的映射。

---

#### 3. **只有盘口/大小分，没有胜负盘** 📊
Polymarket可能只开了盘口（spread）或大小分（over/under），没有直接的胜负盘（moneyline）。

系统会自动过滤掉这些市场：
- ❌ Spread市场
- ❌ Over/Under市场
- ❌ 1H/2H（半场）市场
- ❌ Quarter（单节）市场
- ❌ Points市场

**解决方案**：等待Polymarket开设胜负盘市场

---

#### 4. **API请求失败** 🌐
网络问题或Polymarket API不可用。

**检查方法**：
控制台查找错误：
```
Error fetching NBA events: ...
```

**解决方案**：
- 检查Clash代理是否运行
- 重启开发服务器
- 等待API恢复

---

## 🔧 调试步骤

### 步骤1：查看控制台警告
打开浏览器控制台（F12），刷新页面，查找：
```
⚠️ 无法获取价格: XXX vs XXX
```

### 步骤2：启用详细调试
在 `src/services/polymarket.ts` 第301行附近，修改：
```typescript
// 启用所有比赛的详细调试
const isDebug = true; // 改为 true
```

### 步骤3：查看详细日志
控制台会显示：
```
[调试] Thunder vs Kings - 找到 X 个市场
  检查市场: "Thunder vs. Kings - Winner"
    Outcomes: [Thunder, Kings]
    包含 Thunder? true, 包含 Kings? true
    ✅ 选中此市场！
```

### 步骤4：检查Polymarket网站
1. 访问 https://polymarket.com
2. 搜索比赛（例如 "Lakers Warriors"）
3. 查看是否有 "Winner" 市场
4. 确认队伍名称拼写

---

## 📝 常见问题

### Q: 为什么湖人勇士有价格，国王爵士没有？
A: Polymarket只为热门比赛开盘，不是所有比赛都有。

### Q: 为什么价格显示 "-"？
A: 可能是：
1. Polymarket没有这场比赛
2. 队伍名称不匹配
3. API请求失败

### Q: 如何添加新队伍名称映射？
A: 编辑 `src/services/polymarket.ts`:
```typescript
const TEAM_NAME_MAP: Record<string, string> = {
  // ... 现有映射
  '新队伍中文名': 'New Team English Name',
};
```

### Q: 为什么有些比赛只有盘口没有胜负？
A: Polymarket可以选择开设哪些市场类型，这取决于他们的策略。

---

## 🎯 总结

**大部分情况下，价格拿不到是因为Polymarket没有开盘**。这是正常现象，不是系统问题。

系统会自动：
- ✅ 显示详细的警告日志
- ✅ 跳过没有价格的比赛
- ✅ 继续监控其他有价格的比赛

你只需要关注**有价格的比赛**即可！
