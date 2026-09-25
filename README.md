# 糯米饭运动 RM 力量计算器

这是 `rm.wzrice.cn` 的完整前端源码。项目使用“糯米饭运动”作为运动产品品牌，主品牌仍为“糯米饭大王 / WZRICE”。

## 目录

- `rm-calculator/`：计算器页面、样式、品牌资源、支持页和模型测试
- `rm-calculator/support/`：支持与模型说明页面
- `docs/MODEL.md`：产品模型说明
- `docs/BRANDING.md`：品牌层级与图片资源说明
- `CHANGELOG.md`：版本更新记录

## 当前线上状态

- 线上地址：`https://rm.wzrice.cn`
- 部署项目：`rm-wzrice`
- 运行平台：Cloudflare Pages（纯静态部署）
- 计算器主页和支持页正常使用
- 公式配置直接使用源码默认值
- 页头展示“糯米饭运动 / WZRICE / SPORTS”
- 页脚展示主品牌“糯米饭大王 / WZRICE”

## 安全说明

本备份不包含密码或其他秘密信息。

## 本地测试

在项目根目录执行：

```bash
node --test rm-calculator/test/*.test.js
```

## 部署

```bash
pnpm dlx wrangler@latest pages deploy rm-calculator --project-name rm-wzrice --branch main
```

如 Cloudflare 账号超过一个，需要显式设置正确的 `CLOUDFLARE_ACCOUNT_ID`。
