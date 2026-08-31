# WZRICE RM 力量计算器

这是 `rm.wzrice.cn` 的完整前端源码备份。

## 目录

- `rm-calculator/`：计算器页面、样式、Logo、支持页和模型测试
- `support/`：支持与模型说明页面
- `docs/MODEL.md`：产品模型说明

## 当前线上状态

- 线上地址：`https://rm.wzrice.cn`
- 部署项目：`rm-wzrice`
- 运行平台：Cloudflare Pages（纯静态部署）
- 计算器主页和支持页正常使用
- 公式配置直接使用源码默认值

## 安全说明

本备份不包含密码或其他秘密信息。

## 本地测试

在项目根目录执行：

```bash
node --test rm-calculator/test/rm-core.test.js
```

## 部署

```bash
pnpm dlx wrangler@latest pages deploy rm-calculator --project-name rm-wzrice --branch main
```

如 Cloudflare 账号超过一个，需要显式设置正确的 `CLOUDFLARE_ACCOUNT_ID`。
