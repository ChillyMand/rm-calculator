# 糯米饭运动｜多组 e1RM V3 研究与生产接入

版本：`multiset-capacity-v3.0.0-beta` · 日期：2026-09-26

**当前状态：实验版多组估算已接入生产并发布；仍不能宣传成已验证的个人 1RM 预测公式。**

这版提供可运行公式、可重复校准、2～8 组示例、输入边界和异常状态。生产计算器已通过 `rm-calculator/multiset-v3.js` 接入，支持快捷末组 RIR 与高级逐组设置；旧 V2.1 仅保留作研究对照，不再用于生产计算。

先看 [落地方案与公式](./FORMULA.md)，再看 [证据与局限](./EVIDENCE.md) 和 [验证、完整测试值](./VERIFICATION.md)。

| 文件 | 用途 |
|---|---|
| [FORMULA.md](./FORMULA.md) | 产品交互、公式、参数、状态契约、开发步骤 |
| [EVIDENCE.md](./EVIDENCE.md) | 原始来源、精确数据/读图数据区分、拟合和留出检查 |
| [reference.mjs](./reference.mjs) | 浏览器可直接接入的纯 JavaScript 参考实现 |
| [literature.mjs](./literature.mjs) | 带来源的文献数据；不是用户实测数据 |
| [calibrate.mjs](./calibrate.mjs) | 复现参数、逐研究留出、读图误差敏感性 |
| [reference.test.mjs](./reference.test.mjs) | 自动化软件测试 |
| [examples.mjs](./examples.mjs) | 生成 Markdown / JSON 示例值 |
| [CHANGELOG.md](./CHANGELOG.md) | 相对 V2.1 的变化与本轮纠错记录 |

你的典型情形——80kg、5×5、前组留力、末组接近力竭——默认情景结果：休息 3 分钟约 **101.7kg**；休息 5 分钟约 **97.0kg**。这不是“80kg 做完 5×5 必定等于 100kg”的换算表。

生产页面已经完成参考实现接线、“末组还剩几次余力”快捷选项、逐组高级设置，以及“实验估算 / 假设范围 / 不适用”等状态展示。后续迭代应优先补充公开数据、维持研究实现与生产实现的回归一致性，并继续保留实验标签。

## 生产接入位置

- `rm-calculator/multiset-v3.js`：浏览器端 V3 模型
- `rm-calculator/app.js`：表单输入、状态映射与结果渲染
- `rm-calculator/layout-v3.css`：桌面双栏和移动端单列布局
- `rm-calculator/test/rm-core.test.js`：生产模型回归与边界测试
- `rm-calculator/test/ui-safety.test.js`：页面结构、资源版本和响应式规则检查

## 复现

在仓库根目录、有 Node.js 的终端执行：

```sh
node --test docs/research/multiset-v3/reference.test.mjs
node docs/research/multiset-v3/calibrate.mjs
node docs/research/multiset-v3/examples.mjs
node docs/research/multiset-v3/examples.mjs --json
```

测试通过只证明实现符合这份规格，不证明个人预测准确。
