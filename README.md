# Pet-store · 宠物店日常工作台

服务于单店老板的猫狗洗护、美容、寄养与上门接送系统。手机网页优先，后续微信小程序共用业务后台。

当前完成 **阶段 0及手机测试包：旧程序审查、规则与架构、五页交互＋本机演示保存＋PWA离线缓存**。尚不是营业系统，无账号或跨手机同步。

## 打包给手机测试

```powershell
Set-Location E:\Pet-store
node --test tests/*.test.mjs
powershell -NoProfile -File scripts/package-mobile-test.ps1
```

ZIP生成在`dist/`，包含site静态站点、部署说明和SHA-256清单。**ZIP不能直接安装到苹果或华为**；把site目录部署到独立HTTPS静态托管，再分享链接。不需要自建业务服务器来运行这份虚构演示，但首次打开仍需托管环境。用户已上传腾讯云CloudBase；尚未取得完整公网URL进行独立核验。iPhone截图正常，阿姨手机出现无样式、脚本未完成初始化的现象，原因待查，不能视为两台真机验收通过。详见[当前进度](docs/progress.md)、[部署说明](docs/mobile-test-deployment.md)与[本轮测试报告](docs/mobile-test-report.md)。现有测试包保存在[发布包归档](releases/README.md)，不是本次修复版。

## 看原型

本机已核实 Node.js v24.15.0。无需安装任何依赖：

```powershell
Set-Location E:\Pet-store
node scripts/serve-prototype.mjs
```

打开 http://127.0.0.1:4173 。仅监听本机，不能将此链接发给手机作为部署地址。演示进度保存到当前浏览器；第一次缓存就绪后可试离线。清理浏览器或系统回收可丢失记录，不作为备份。不收款、不发通知、不创建真实预约。网页更新后如出现更新按钮，点击以切换新缓存版本。

```powershell
node --test tests/*.test.mjs
node scripts/check-project.mjs
```

## 交接入口

- [当前进度和下一切片](docs/progress.md)
- [原规划（保留建议稿性质）](docs/development-plan.md)
- [原阶段0提示词（历史输入，并非本轮执行指令）](docs/phase0-original-prompt.md)
- [旧程序实测审查](docs/legacy-audit.md)
- [经营规则及八组确认问题](docs/business-rules.md)
- [架构决定与状态边界](docs/architecture.md)
- [迁移方案](docs/migration-plan.md)
- [验收用例](docs/acceptance.md)
- [原型试用说明](docs/prototype.md)

`work/` 内审查副本与原始营业资料不进入版本控制。今后SQLite检查仅打开隔离副本；本轮首次只读打开曾产生两个辅助文件，主库哈希未变，详见 legacy-audit。实际测试结果见 progress；后续源码、契约、迁移和部署说明继续在本仓库维护。
