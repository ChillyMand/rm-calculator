# 糯米饭运动｜多组 e1RM V3 开发交付

版本：`multiset-capacity-v3.0.0-beta` · 日期：2026-09-26

**结论：可以开始开发“实验版多组估算”，不需要用户组织受试者实验；不能宣传成已验证的个人 1RM 预测公式。**

这版已提供可运行公式、可重复校准、2～8 组示例、输入边界、异常状态和接入规则。没有修改生产计算器、部署或推送 GitHub。旧 V2.1 保留用于对照，不建议继续按旧奖励逻辑开发。

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

后续最直接的开发动作：把参考实现接到多组页，增加一个“末组还剩几次余力”的快捷选项，去掉组数/休息/稳定性奖励，并按状态展示“实验估算 / 假设范围 / 不适用”。无需先做用户实验，也不需要继续等待一条所谓完美公式。

## 复现

在仓库根目录、有 Node.js 的终端执行：

```sh
node --test docs/research/multiset-v3/reference.test.mjs
node docs/research/multiset-v3/calibrate.mjs
node docs/research/multiset-v3/examples.mjs
node docs/research/multiset-v3/examples.mjs --json
```

测试通过只证明实现符合这份规格，不证明个人预测准确。
