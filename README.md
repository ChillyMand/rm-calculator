# 糯米饭运动 RM 力量计算器

这是 `rm.wzrice.cn` 的完整前端源码。项目使用“糯米饭运动”作为运动产品品牌，主品牌仍为“糯米饭大王 / WZRICE”。

## 目录

- `rm-calculator/`：计算器页面、样式、品牌资源、支持页和模型测试
- `rm-calculator/multiset-v3.js`：生产环境使用的多组 e1RM V3 实现
- `rm-calculator/layout-v3.css`：桌面与移动端响应式布局
- `rm-calculator/support/`：支持与模型说明页面
- `docs/MODEL.md`：产品模型说明
- `docs/research/multiset-v3/`：V3 公式、证据、校准和验证材料
- `docs/BRANDING.md`：品牌层级与图片资源说明
- `CHANGELOG.md`：版本更新记录

## 当前线上状态

- 线上地址：`https://rm.wzrice.cn`
- 部署项目：`rm-wzrice`
- 运行平台：Cloudflare Pages（纯静态部署）
- 计算器主页和支持页正常使用
- 单组模式保留 8 公式估算；多组模式已接入 `multiset-capacity-v3.0.0-beta`
- 多组模式支持同动作、同重量下的 2～8 个正式组，并明确展示实验或不适用状态
- 桌面端使用对齐的双栏工作台；960px 以下切换为自然单列布局
- 右侧结果与公式卡片随页面正常滚动，不使用粘性定位
- 公式配置直接使用源码默认值
- 页头展示“糯米饭运动 / WZRICE / SPORTS”
- 页脚展示主品牌“糯米饭大王 / WZRICE”

## 安全说明

本备份不包含密码或其他秘密信息。

## 本地测试

在项目根目录执行：

```bash
node --test rm-calculator/test/*.test.js
node --test docs/research/multiset-v3/reference.test.mjs
```

## 部署

```bash
pnpm dlx wrangler@latest pages deploy rm-calculator --project-name rm-wzrice --branch main
```

如 Cloudflare 账号超过一个，需要显式设置正确的 `CLOUDFLARE_ACCOUNT_ID`。
