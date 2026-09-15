# 阶段 0 · 旧程序只读审查

审查日期：2026-09-14。事实来自本地文件、ASAR 内部校验和 SQLite 只读查询；不引用规划草案作为运行证据。

## 资料与方法

- 仓库 E:\Pet-store，main 跟踪 origin/main，远端为用户指定 Pet-store；本轮开始仅 README，无未提交改动，HEAD 为 4ace929。
- 原安装位置 D:\宠物店\pet-salon-records；快捷方式 C:\Users\ZhuanZ\Desktop\宠物店收银与会员.lnk。
- 本轮实际审查备份 E:\宠物店收银与会员_完整备份_20260914_105953：`安装目录/宠物店/pet-salon-records/resources/app.asar` 与 `用户数据/pet-salon-records/salon.db`。
- `node scripts/audit-legacy.mjs <备份目录>`：读取 ASAR 的长度/偏移头，校验每个提取文件 SHA-256；13 个应用代码/配置文件写入被 Git 忽略的 work/legacy-source。另一个 data/*.bak 是旧 JSON 数据，不提取进源码。
- SQLite 以 readOnly + query_only 查询，不执行应用初始化。首次直接打开备份产生了辅助文件（见下方复核）；工具已改为先复制到被忽略的work/legacy-audit，再打开隔离副本。只输出结构、条数、异常数量；没有打印客户行、私人联系方式或金额明细。
- app.asar SHA-256：`2c5dba092092ff04bf4bb7021d32886cc6e58ec26c0d476509f3a9c851f71710`。
- salon.db SHA-256：`2443400ce235f635b9dbdb6d492c02b2fa4c5757984493e6bac87a4893da92df`；审查前后及当前源库相同。

### 收尾备份复核与检查工具修正

安装目录102文件、293856857字节与当前源逐文件相同；快捷方式986字节hash相同。用户目录当前28文件、626847字节在备份中均存在且hash相同，但备份有56文件，多28个，所以严格目录一致性检查返回1，不能写“本轮备份完全无改动”。

26个多余项是Cache、Code Cache、DawnGraphiteCache、DawnWebGPUCache、GPUCache下的旧缓存；当前源已没有这些文件，删除原因未能从现有证据确定，本轮没有清理它们。另2个是首次SQLite只读检查生成的salon.db-wal（0字节）和salon.db-shm（32768字节，15:03:12）。readOnly限制SQL写入，不保证目录没有辅助写入；主库hash始终一致，未发现丢失或不一致的共有文件。所有备份项均保留，没有为通过检查而删除辅助文件。

已增加audit-snapshot隔离复制与WAL模式虚构库回归测试，并在隔离副本重跑审查成功。以后仅用文件读取访问原备份。没有验证NTFS所有权/审计信息、整机恢复或正式营业恢复，不承诺系统级100%恢复。

## 实际结构

源码证据位置以下均相对于 work/legacy-source；重新执行审查脚本可恢复相同行号。

| 文件 | 实际作用 | 复用判断 |
|---|---|---|
| package.json | pet-salon-records 1.0.0；main.js；better-sqlite3 ^11.8.1 | 未包含启动、打包脚本和 Electron 版本；不能推断原开发锁文件 |
| main.js:7、19、64 | Electron 窗口、初始化数据库、IPC handlers | 替换为服务器启动和 HTTP 控制器，不能直接公开 IPC |
| preload.js:3 | 暴露 window.api 的 IPC 桥 | 替换为契约驱动 API 客户端 |
| app.js:726、806 | DOM 表单校验、客户端计价和一次性新增订单 | 改为手机步骤与独立履约任务；重新实施服务端计价 |
| index.html:9、styles.css | 桌面表单、Chart.js CDN 图表、样式 | 可参考文字与配色；移动页面重新布局，原型不访问 CDN |
| lib/store-sqlite.js:29、147 | userData 路径、表创建/迁移、SQL 与业务函数 | 拆分业务模块，迁移 PostgreSQL；不整体复制进网络服务 |
| main-json.js | 旧 JSON 存储实现，当前入口不引用 | 仅作为历史格式参考，不维护第二套后台 |
| scripts/clear-customer-data.js:24 | 删除会员、充值、订单 | 本轮未执行，不带入新系统操作入口 |
| scripts/stress-test-sqlite.js:59 | 向工作数据目录写大量订单 | 本轮未执行；不是只读性能测试或现成并发验收 |

## 实际数据库对象

| 表 | 行数 | 已读到的主要字段与限制 |
|---|---:|---|
| members | 1 | id、phone、nickname、balance REAL、created_at；非空 phone 唯一索引 |
| recharges | 1 | id、member_id、amount REAL、note、created_at；member_id 外键 |
| orders | 1 | id、guest_name/phone/type、member_id、pet_* 快照、preinspect_json、services_json、payment_method、total_amount REAL、deducted_from_balance REAL、created_at |
| service_catalog | 7 | id、name、price REAL、sort_order |

7 个显式索引；无独立客户/宠物/预约/资源/寄养/接送/退款/身份/审计表。订单没有服务开始、完成、交还状态，不能由一条旧订单推断这些动作已经发生。

实际检查：integrity_check = ok；foreign_key_check 异常 0；负余额、空会员电话、非空重复电话组、会员余额重建差异、孤立充值、孤立会员订单、非法服务 JSON 均为 0。余额重建只是 `累计充值−订单累计扣款` 与当前余额的数值一致性检查，未证明余额真实、归属正确或可退本金。

仅一条记录也不能推断全部是演示数据；真实/演示性质保持待核验。没有检查其他电脑、商家后台或备份之后新增的数据。

## 直接影响改造的发现

1. **金额需重新设计**：store-sqlite.js:63 使用浮点 round2，:784 接受客户端 totalAmount 和 deductedFromBalance，:814 用 `deducted || totalAmount`。缺少非负金额、扣款与有效服务价关联等完整服务端校验；不能照搬到多用户 API。示意上负扣款可能增加余额，这是静态推断，本轮没有对原库执行漏洞请求。
2. **删除会损失账本**：store-sqlite.js:650 删除充值、清空订单会员关联、删除会员；app.js:1235 确认框明确提示余额作废。新系统应停用/受控去标识档案，保留资金来源和历史，不继承删除流水行为。
3. **重复操作防护不足**：memberRecharge:456、orderAdd:736 有 SQLite 事务，但没有持久幂等键、退款额度预占及并发版本。旧单机事务不能证明新多端资金安全。
4. **录入负担**：store-sqlite.js:788 起对年龄、性别、体型体重、驱虫、疫苗、绝育逐项强制；驱虫只允许体内/体外，无未知/两者表达。将客宠档案与每次服务分离；接宠条件由老板确认，不能把历史查验当这次合格。
5. **查询没有对象权限**：main.js:64 起 IPC 无用户角色校验，store-sqlite.js:523、680 按电话返回会员或建议（含余额）。不能把旧查询接口直接用于客人手机端。
6. **经营汇总不是收款账本**：dashboardAggregate:997 求订单总额、:1002 求余额消费，没有充值渠道、退款和平台待结算；历史“营业额”不能直接映射外部现金到账。
7. **初始化会改库**：initDatabase:337 调用迁移、默认目录等；migrateLegacyCatalog:233 可以删除并重建服务目录。本轮仅用 node:sqlite 只读查看，没有调用旧初始化。

## 可以继承的部分

- 字段含义、服务项目用词、历史服务与宠物快照可为迁移映射提供证据。
- normalizePhoneDigits:52、escapeSqlLike:80、keywordSearchTokens:85、normalizePreinspectPayload:504 的意图可提取为纯函数；移植前写特征测试，重新处理手机号国家/共用号码和结构长度边界。
- 日期函数 :68、:872 依赖运行机器本地时区，保留按日/周查询需求，改用显式门店时区计算。
- 参数化 SQL、交易内写入的设计意图值得保留；SQL 语句和 REAL 金额不直接复用。

结论：以现有业务知识和经过核验的数据为迁移起点，重新建设共享后台与手机流程。未计算虚假的源码复用百分比，未声称新系统已可营业。
