// ==UserScript==
// @name         高校邦助手 (全能版：刷课 + 自动答题 + AI 回复讨论)
// @namespace    https://github.com/Thejiuyi
// @version      1.0.1
// @description  高校邦全能助手。合并自「高校邦脚本(修改版)」「高校邦一键完成，自动答题静音播放」，并新增 AI 自动回复讨论。功能：静音自动播放（含失焦防暂停）、全类型自动跳章（视频/音频/文档/讨论/测验统一按目录进度判定）、逐题自动答题、AI 生成讨论回复。不干预播放速度（请配合 Global Speed 等扩展使用）。测验/作业章节可独立选择「跳过」或「先答完再跳」（默认跳过）；页面暂停按钮刷新后仍然有效；AI 返回空内容时会给出具体原因，并按额度阶梯自动重试。课程目录页（/class/<id>/unit）不会自动跳章 —— 那是你挑章节的地方。Course announcements, score analysis, quiz/assignment/exam lists, the forum list, the wrong-answer book and the activity page do not run anything (the button says so) — only chapter pages (/unit/<u>/chapter/<c>/) and whole-paper quiz pages (/quiz/<id>/) run.各功能均可在页面顶部面板的「设置」里开关（篡改猴菜单只保留面板相关项）。
// @author       yuanYue, PY-DNG, Xisney, (合并与 AI 部分由 WorkBuddy 完成)；维护：Thejiuyi
// @match        *://*.class.gaoxiaobang.com/*
// @run-at       document-idle
// @license      MIT
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    /* ============================================================
     *  作者与维护
     *
     *  本脚本合并自三份原始脚本，**原作者署名保留**（见 @author）：
     *    · yuanYue · PY-DNG · Xisney
     *    合并与 AI 部分由 WorkBuddy 完成。
     *
     *  当前维护：Thejiuyi
     *
     *  ⚠️ 维护者必须写在 @author **同一行**里。
     *     用户脚本的元数据块是按 `// @key value` 逐行解析的，
     *     不带 `@` 的续行会被脚本管理器**静默忽略** ——
     *     文件看着正常，篡改猴里却看不到维护者（改了等于没改）。
     *     test-min.mjs 有两条断言守着这个契约。
     *
     *  ⚠️⚠️【v1.0.1】@namespace 已从 `https://github.com/yuanYue-byte`
     *     改为 `https://github.com/Thejiuyi`。
     *
     *     篡改猴用 **@name + @namespace** 当脚本的唯一标识 ⇒ 换了 namespace，
     *     它会把这一版当成**另一个脚本**，而**不是旧版的升级**！
     *     ⇒ 旧版会**留在篡改猴里**，两版共存、各自按自己的规则跳章、互相抢。
     *
     *     ✅ 迁移动作：**到篡改猴管理面板删掉旧版**（只留最新的那份），然后刷新页面。
     *     ✅ 不用怕忘：本脚本自带的多实例自检会数 `#gxb-helper-pause` 出现几次，
     *        两版同时跑就会在页面上弹红条提醒你「只保留最新版」。
     *
     *  ⚠️ 下面注释里出现的作者名（例如「来自被合并的脚本 2（Xisney 版）」
     *     「yuanYue v0.5 ：…」「PY-DNG v0.9 ：…」）是【代码溯源 / 取证记录】，
     *     回答的是「那段代码当初来自谁、当年是怎么写的」—— 属于**历史事实**，
     *     不随维护者变更而改写。要改署名请看上面的 @author。
     * ============================================================ */

    /* 【v2.5.11】脚本版本号 —— 启动横幅用它，不再手写死。
     *
     * ⚠️ 起因：横幅里的版本号原来是**手写死的字符串**，v2.5.10 发布时忘了改，
     *    于是 v2.5.10 的产物一直打印「v2.5.9 已加载」。
     *    危害不小 —— 横幅正是用来「数页面上跑了几份脚本」的
     *    （多版本共存是本站最常见的坑），版本号对不上就**分不出哪个是旧版**：
     *    用户明明装了新版，看到 v2.5.9 会以为没生效，反而去重装一遍。
     * ⇒ 全脚本只有这一个版本常量；test-v2511.mjs 会断言它 === @version，
     *    防止下次升版又漂移（派生常量必须被断言，见 skill 8.34）。 */
    /* 【v1.0】版本号从 2.5.23 **重置为 1.0**（换维护者后重新编号）。
     *
     * ⚠️ 这是**降版**。篡改猴按版本号判新旧，所以：
     *    · 本脚本**没有** @updateURL / @downloadURL（手动安装）⇒ 不存在
     *      「自动更新把版本拉回去」的问题；
     *    · 手动安装时它可能提示「这是旧版本」，确认即可；
     *    · **若同时装着 2.5.23，先删旧的再装 1.0** —— 两版共存会互相抢跳章
     *      （本项目反复踩的坑，面板上写版本号、多实例自检都为排查它）。
     *
     * ⚠️ 重置后「版本不低于 X」这类护栏失去意义（见各测试里的
     *    assertVersionContract）。现在真正承重的是：
     *      · SCRIPT_VERSION === @version（test-v2511 守着，防派生常量漂移）
     *      · 各功能自己的行为 / 静态断言（不依赖版本号） */
    const SCRIPT_VERSION = '1.0.1';

    /* ============================================================
     *  一、默认配置
     *  全部开关可在「篡改猴面板 → 高校邦助手」菜单里修改，刷新页面生效。
     *  API Key 存在浏览器本地（GM_setValue），不会写进源码。
     * ============================================================ */

    const DEFAULTS = {
        // ---- AI 接口（OpenAI 兼容格式，填到 /chat/completions）----
        //   DeepSeek   https://api.deepseek.com/v1/chat/completions
        //   通义千问   https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
        //   智谱 GLM   https://open.bigmodel.cn/api/paas/v4/chat/completions
        //   月之暗面   https://api.moonshot.cn/v1/chat/completions
        //   本地Ollama http://localhost:11434/v1/chat/completions
        apiUrl: '',
        apiKey: '',
        model: 'deepseek-chat',
        systemPrompt:
            '你是一名大学生，正在高校邦在线课程的讨论区参与讨论。' +
            '针对老师给出的讨论话题，写一段自然、口语化、像学生本人写的回复。' +
            '要求：紧扣话题且有具体观点；' +
            /* 【v2.5.6】原来这里写的是「80~150 字」——
             *   a) 那是中文字数概念，英文题按它写会要么太短要么太长；
             *   b) 整段提示词是中文，模型很容易把英文题也答成中文（用户实测踩到）。
             * 现在：语言和长度都交给按题目语言生成的「语言要求」补丁（见 langClause）。 */
            '【必须用与讨论话题相同的语言写】：题目是英文就全篇英文（不得出现中文字符），' +
            '题目是中文就用中文；' +
            '不要使用 markdown 标记或序号列表；不要出现「首先其次最后」这类套话；' +
            '不要暴露你是 AI；只输出回复正文，不要任何解释或前缀。',
        // 【v2.2.1 起作废】原「AI 失败时自动提交的兜底文案」，保留字段仅为向后兼容。
        // 用户明确要求：不要保底答案。理由：
        //   a) 兜底文案与题目无关（题目可能是全英文提问），老师一眼看出是机器人；
        //   b) 高校邦规则「已发送回复可编辑、但不可删除」→ 提交即留痕、无法清除。
        // 现在 AI 失败一律停止，等用户配好再说。
        fallbackText: '',

        // ---- 功能开关 ----
        autoVideo: true,         // 自动播放视频（静音）
        autoNext: true,          // 自动跳下一章
        autoQuiz: true,          // 自动答题（视频弹题：抄页面下发的正确答案）

        /* 【v2.5.13】整卷测验页（/quiz/<id>）AI 自动作答 —— **默认关**。
         *
         * 为什么默认关：这是本脚本里**唯一不可撤销**的功能。
         *   实测（2026-09-21 交卷实验）：18 套测验里 15 套有 3 次机会，
         *   但有 3 套**只有 1 次**（错一次就是该章 0 分）。交出去就收不回来。
         *
         * 打开后的行为：
         *   进入 /quiz/<id> 页 → 读整卷 → 一次性发给 AI → 按 AI 给的 answer_id 点选
         *   → 点提交 → 点确认弹窗（**两层**）→ 跳结果页。
         *
         * ⚠️ 任何一步不确定就【停下 + 说明】，绝不"凑合交卷"。
         *    宁可这一套留给你手动做，也不交一份烂卷把机会烧掉。
         *
         * 切换入口：面板「设置」。 */
        autoQuizPaper: false,
        /* 【v2.5.18】关闭「思考模式」——**默认 true**。
         *   理由：本站题目是选择题，关掉思考不影响答案质量；
         *   而开着思考会让整卷作答**必然失败**（额度在思考阶段耗尽，content 为空）。
         *   少数平台不支持这个字段并报 400 ⇒ 把它们设成 false 即可。 */
        disableThinking: true,
        /* 【v2.5.5】讨论题处理方式（三选一，【互不兜底】）：
         *   'skip' 跳过（默认）—— 不提交任何内容，页面提示后继续跳下一章
         *   'copy' 抄答案      —— 抄讨论区里已有的一条同学回复提交；
         *                          抄不到 → 同样不提交，页面报错后继续（用户要求「抄不到就跳过并报错」）
         *   'api'  接入 API    —— AI 生成；失败则【停下 + 报错】等人工处理
         *                        （这是意外错误、不是用户主动选择，所以不跳）
         * 切换入口：面板「设置」。 */
        topicMode: 'skip',
        /* 【v2.5.5】上次选过的服务商预设 id（仅用于菜单里回显，逻辑上不参与判断） */
        apiPreset: '',
        /* 【v2.5.5 起由 topicMode 取代】旧开关，只在一次性迁移时读一次。
         *   留着是为了「老用户升级后不会静默从 AI 回复变成跳过」——
         *   静默改成跳过 = 讨论题不提交，可能直接丢分。 */
        autoTopicReply: true,
        /* 【v2.5.5】原「教师答疑区抄既有回复」开关。
         *   ⚠️ 它在 v2.5.4 里是个【死键】：声明了但没有任何代码读它。
         *   本版把它想做的事真正实现成 topicMode='copy'，此键不再使用，仅保留占位。 */
        autoTeacherReply: true,
        skipNonVideo: true,      // 非视频章节（课件/作业/测验）自动跳过
        /* 【v2.5.8】测验 / 作业章节（目录 content_type = Quiz / Assignment / Exam /
         *   Homework）怎么处理：
         *     'skip'   立刻跳，不答题 —— 默认值。
         *     'answer' 先答完再跳 —— 给答题链路留 grace*3 的窗口；
         *                          交卷后立刻跳，超时仍未交卷则跳过并说明原因。
         *   ⚠️ 为什么要拆成独立开关：原先「跳过非视频章」一个开关同时管了
         *      「文档章跳不跳」和「测验章答不答题」两件事，想答题就必须连
         *      文档章一起不跳，两件事被绑死。
         *   切换入口：面板「设置」。 */
        quizChapterMode: 'skip',
        antiBlur: true,
        showPauseBtn: true,   // 【v2.5.0】页面右下角的暂停按钮（需求1）          // 对抗「切走标签页就暂停播放」
        // 【v2.4.0】无进度可读的页面（纯文档，目录进度也拿不到时）的兜底停留时长。
        // 正常情况下走「读目录进度」判定，这个值只在读不到进度时才用。
        docGraceMs: 12000,
        // 【v2.4.0】讨论页 AI 失败/未配 Key 时，除了停下不动，是否在页面上弹一个
        // 显眼的提示条（用户要求「停下但弹提示告诉我」，避免以为脚本坏了）。
        topicStuckHint: true,
        /* 【v2.5.20】顶部控制面板（可拖动 / 可最小化）。
         *   showTopBar  = 总开关（菜单 ②，关掉即整块移除，刷新无需重载）
         *   uiTopBarPos = 拖动后的位置，JSON 字符串 '{"left":N,"top":N}'
         *                 （存字符串而不是对象：GM_setValue 在部分脚本管理器里
         *                   对对象序列化行为不一致，字符串最可移植）
         *   uiTopBarMin = 是否处于最小化状态
         * ⚠️ 三个都用 cfg() 读，走 DEFAULTS 兜底 ⇒ 老用户升级后不会读到 undefined。 */
        showTopBar: true,
        uiTopBarPos: '',
        uiTopBarMin: false,
        debug: false,
    };

    /* 【v2.3.0 起移除】
     *   · 播放速度（幽灵模式 / 真倍速）：平台仍会检测，且维护成本高。
     *     用户改用 Global Speed 扩展自行控制倍速，脚本不再干预 playbackRate。
     *   · 一键完成：伪造播放记录，实测已失效（服务端校验变化），且风险最高，
     *     整体删除，不再保留开关。
     */

    /* ============================================================
     *  【v2.5.5】常用 AI 服务商预设
     *
     *  选一个 → 自动填好「地址 + 建议模型名」，你只需要再填 API Key。
     *
     *  ⚠️ 地址和模型名都会变（有的平台还在迁移，比如腾讯混元正在迁到 TokenHub）。
     *     所以这里只是【省打字】，不是权威：
     *       · 模型名随时可以手改（面板「设置」）
     *       · 填错了用面板「设置」「测试 AI 连接」——它真发一次请求，把服务商的报错原样给你
     *     采集时间 2026-09-19，以各平台官方文档为准。
     * ============================================================ */
    const API_PRESETS = [
        { id: 'deepseek', name: 'DeepSeek（便宜、国内最常用）',
          url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
        { id: 'glm', name: '智谱 GLM（有免费模型 glm-4.7-flash）',
          url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.7-flash' },
        { id: 'qwen', name: '通义千问（阿里云百炼）',
          url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
        { id: 'kimi', name: 'Kimi 月之暗面',
          url: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
        { id: 'siliconflow', name: '硅基流动（有免费模型）',
          url: 'https://api.siliconflow.cn/v1/chat/completions', model: 'Qwen/Qwen3-8B' },
        { id: 'hunyuan', name: '腾讯混元（注意：正在迁移到 TokenHub，地址可能会变）',
          url: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', model: 'hunyuan-lite' },
        { id: 'qianfan', name: '百度千帆（文心）',
          url: 'https://qianfan.baidubce.com/v2/chat/completions', model: 'ernie-speed-128k' },
        { id: 'ark', name: '火山方舟（豆包）—— 模型名要填你自己的推理接入点 ep-xxxxxx',
          url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', model: '' },
        { id: 'openrouter', name: 'OpenRouter（海外，模型名去官网复制，带 :free 的是免费档）',
          url: 'https://openrouter.ai/api/v1/chat/completions', model: '' },
        { id: 'ollama', name: '本地 Ollama（不花钱，需要本机跑着）',
          url: 'http://localhost:11434/v1/chat/completions', model: 'qwen2.5:7b' },
        { id: 'custom', name: '自定义（自己填地址和模型名）', url: '', model: '' },
    ];

    // 每次都从存储读，改完设置立即生效
    const cfg = (key) => GM_getValue(key, DEFAULTS[key]);
    /* 【v2.5.20】最近日志环形缓冲 —— 顶部面板拿它当「不用开 F12 的控制台」。
     *
     * ⚠️ 必须声明在 log() **之前**：log() 里要用它。
     *   若挪到文件后半段（面板那一节）再声明，任何在那一行之前执行的 log()
     *   都会撞上 const 的 TDZ，抛 ReferenceError —— 而且是**只在特定路径下**抛，
     *   极难复现。放这里最安全（紧邻使用点，不依赖执行顺序）。
     *
     * 为什么要它：用户明确说过「不开 F12」。日志只进 console 等于没告诉他。 */
    const LOG_RING_MAX = 40;
    const logRing = [];
    function pushLogRing(line) {
        const t = String(line == null ? '' : line).replace(/\s+/g, ' ').trim();
        if (!t) return;
        /* 连续重复不入队：主循环每秒可能打同一句，否则环形缓冲会被刷爆，
         * 用户看到的「最近日志」永远只有那一句。 */
        if (logRing.length && logRing[logRing.length - 1] === t) return;
        logRing.push(t);
        if (logRing.length > LOG_RING_MAX) logRing.splice(0, logRing.length - LOG_RING_MAX);
    }

    const log = (...a) => {
        /* 【v2.5.20】debug 关着也留一份给面板（面板就是用户的控制台）。 */
        pushLogRing(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' '));
        if (cfg('debug')) console.log('[高校邦助手]', ...a);
    };

    /* 【v2.5.5】一次性迁移：老版本只有 autoTopicReply（true=AI 回复 / false=不回复），
     * 没有 topicMode。若直接读默认值，老用户升级后会【静默】从「AI 回复」变成「跳过」——
     * 讨论题不提交、可能直接丢分。所以这里把旧值翻译过来，只做一次。
     * 判断依据是「存储里有没有 topicMode 这个键」，而不是它的值 ——
     * 用户主动选了 'skip' 之后不能被再次覆盖。 */
    (function migrateTopicMode() {
        if (GM_getValue('topicMode', undefined) !== undefined) return;   // 已经用过新开关
        const oldAuto = GM_getValue('autoTopicReply', true);
        GM_setValue('topicMode', oldAuto ? 'api' : 'skip');
        console.log('[高校邦助手] 已把旧的「AI 自动回复讨论=' + oldAuto + '」迁移为 topicMode=' +
            (oldAuto ? 'api' : 'skip') + '（可在面板「设置」 修改）');
    })();

    /* ============================================================
     *  二、通用工具
     * ============================================================ */

    /* ------------------------------------------------------------
     * 【v2.3.0 新增】对抗「视频失焦自动暂停」
     *
     * 平台会在 window 上监听 blur / visibilitychange，用户一切走标签页就暂停播放。
     * 这段代码来自被合并的脚本 2（Xisney 版），做法是劫持 window.addEventListener，
     * 直接吞掉 blur 类监听器的注册。
     * （「Xisney 版」是**代码溯源**，保留原样；本版维护：Thejiuyi）
     *
     * 相比原版做了三点加固（原版有几个隐患）：
     *   a) 原版无条件 return，会把页面**所有**逻辑的 blur 回调都吞掉，包括
     *      平台自己「保存进度 / 上报心跳」的 blur 逻辑 → 反而可能丢进度。
     *      这里默认仍全吞（这是用户要的行为），但把「被吞掉的次数」记下来，
     *      调试模式下可见，出问题能查。
     *   b) 原版没处理 visibilitychange。很多站点靠这个而非 blur，
     *      只拦 blur 会「拦了但没用」。这里两种都拦。
     *   c) 用 defineProperty 挂成只读，避免页面再改回来（原版可被覆盖）。
     * ---------------------------------------------------------- */
    (function installAntiBlur() {
        if (!cfg('antiBlur')) return;

        const origAdd = window.addEventListener;
        const KILL = ['blur', 'visibilitychange', 'pagehide', 'mozvisibilitychange', 'webkitvisibilitychange'];
        let killed = 0;

        function patched(type, listener, options) {
            if (KILL.includes(type)) {
                killed++;
                if (cfg('debug')) console.log('[高校邦助手] 已拦截 ' + type + ' 监听器（防失焦暂停），累计 ' + killed + ' 次');
                return;   // 不注册 = 平台收不到失焦事件
            }
            return origAdd.call(window, type, listener, options);
        }
        // 保留原方法，个别场景需要放行时可调用
        patched.__original = origAdd;
        try {
            Object.defineProperty(window, 'addEventListener', {
                value: patched, writable: false, configurable: true,
            });
        } catch (e) {
            window.addEventListener = patched;   // 降级：至少能用
        }
    })();

    const q = (sel, root = document) => root.querySelector(sel);
    const qa = (sel, root = document) => [...root.querySelectorAll(sel)];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const visible = (el) => !!el && el.offsetParent !== null;

    // 用「元素真实可见」判断，避免把 display:none 的按钮误判为存在
    const shown = (sel) => visible(q(sel));

    /* ============================================================
     *  【v2.5.0 新增】需求1：页面内「暂停 / 继续」按钮
     *
     *  用户诉求：自动跳章节时要能在网页里看到一个暂停按钮。
     *
     *  设计取舍：
     *  - 状态存在 sessionStorage 里 —— 同一标签页内【刷新 / 切章重载都保留】，
     *    关掉标签页才恢复运行。
     *    用户实测反馈「全局暂停在刷新网页后就失效」：本站切章是整页重载，
     *    平台自身也会重载页面，纯内存变量等于暂停随时会掉 —— 用户看到的是
     *    「我明明按了暂停，它又自己跳了」。
     *    不用 GM 存储（跨标签页、跨天持久），是为了避免「昨天按过暂停，
     *    今天以为脚本坏了」——这正是本项目反复踩过的坑。
     *  - 暂停态下【强制显示】按钮，即使面板「设置」 把按钮关了：
     *    否则「暂停被持久化 + 按钮被关掉」= 用户没有任何恢复入口。
     *  - 用【全局暂停】：跳章、自动答题、AI 回复讨论全部停下。
     *    用户明确选择「全局暂停开关」（而非只停跳章）。
     *  - 状态播报与功能开关分离：暂停是「说不说」的维度，
     *    即使暂停也要让用户看出「是按了暂停」，所以按钮文案本身要变。
     * ============================================================ */
    const PAUSE_KEY = 'gxb-helper-paused';

    /* sessionStorage 在隐私模式 / 部分沙箱里可能抛异常 → 退化为纯内存，
     * 功能不受影响，只是刷新后不保留。绝不因为存储不可用而让脚本崩掉。 */
    function readPauseFlag() {
        try { return sessionStorage.getItem(PAUSE_KEY) === '1'; } catch (e) { return false; }
    }
    function writePauseFlag(on) {
        try {
            if (on) sessionStorage.setItem(PAUSE_KEY, '1');
            else sessionStorage.removeItem(PAUSE_KEY);
        } catch (e) { /* 存储不可用 → 退化，见上 */ }
    }

    let paused = readPauseFlag();

    function isPaused() {
        return paused;
    }

    function setPaused(next) {
        paused = !!next;
        writePauseFlag(paused);
        log(paused
            ? '已暂停（跳章/答题/讨论回复全部停止）· 本标签页刷新后仍然暂停'
            : '已继续（本标签页刷新后不再暂停）');
        renderPauseButton();
        /* 【v2.5.20】面板上的暂停按钮文案（暂停/恢复）与状态行都要跟着变 */
        renderTopBar();
    }

    /* 按钮渲染：固定右下角，风格与「卡住提示条」区分（蓝底 vs 黄底） */
    let pauseBtnEl = null;
    function renderPauseButton() {
        /* 用户可在面板「设置」 关掉这个按钮（不希望页面上多出东西时）。
         * ⚠️ 但【暂停态下必须强制显示】：暂停状态现在是持久化的，
         *    若按钮又被关掉，用户就没有任何恢复入口，只能去手动清 sessionStorage。 */
        if (!cfg('showPauseBtn') && !paused) {
            if (pauseBtnEl && document.body.contains(pauseBtnEl)) pauseBtnEl.remove();
            pauseBtnEl = null;
            return;
        }
        if (!document.body) return;   // 文档还没就绪，下一轮再画

        if (!pauseBtnEl || !document.body.contains(pauseBtnEl)) {
            const d = document.createElement('div');
            d.id = 'gxb-helper-pause';
            d.style.cssText = [
                'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483646',
                'padding:9px 16px', 'border-radius:20px', 'cursor:pointer',
                'font:13px/1.5 -apple-system,"Microsoft YaHei",sans-serif',
                'user-select:none', 'box-shadow:0 3px 12px rgba(0,0,0,.2)',
                'transition:background .15s,color .15s',
            ].join(';');
            d.addEventListener('click', (e) => {
                e.stopPropagation();
                /* 【v2.5.17】失败态：首次点击先弹【完整原因】（用户不开 F12）。
                 *   ⚠️ 不能因此弄丢暂停入口 —— 弹窗里明确告诉他再点一次就是暂停。
                 *   第二次点击（或已看过）→ 正常暂停/继续，行为与旧版一致。 */
                if (paperReasonFull && !paperReasonSeen) {
                    paperReasonSeen = true;
                    try {
                        alert('测验未能自动作答，完整原因如下：\n\n' +
                            paperReasonFull +
                            '\n\n——\n（再点一次这个按钮 = 暂停/继续所有自动功能）');
                    } catch (_e) { /* alert 被拦也不能影响暂停 */ }
                    return;
                }
                /* 【v2.5.19】「本卷已完成」同样要点得开详情 —— 用户不开 F12，
                 *   而按钮一行放不下「得分/对错/剩余次数」三项。
                 *   ⚠️ 顺序：失败详情优先（它更紧急），互不覆盖（不同分支写入）。 */
                if (submittedDetail && !submittedDetailSeen) {
                    submittedDetailSeen = true;
                    try {
                        alert(submittedDetail);
                    } catch (_e) { /* alert 被拦也不能影响暂停 */ }
                    return;
                }
                setPaused(!paused);
            });
            document.body.appendChild(d);
            pauseBtnEl = d;
        }

        // 文案 + 配色随状态切换（暂停时明确告诉用户「已暂停」）
        if (paused) {
            pauseBtnEl.textContent = '▶ 已暂停 · 点击继续';
            pauseBtnEl.style.background = '#e5484d';
            pauseBtnEl.style.color = '#fff';
            pauseBtnEl.title = '所有自动功能已暂停：不跳章、不答题、不回复讨论（刷新后仍保持暂停，点此继续）';
        } else {
            /* 【v2.5.12c】有钉住的提示（pinnedHint > 0）时【不许】覆盖文案。
             *
             * 实测取证（_diag-pin2.mjs：给 Node.prototype.textContent 打桩 + 打调用栈）：
             *   @1059ms "⏸ 运行中 · 点击暂停"    ← 本函数
             *   @1060ms "⏸ 测验页 · 不自动作答"  ← 守卫写入（priority=1）
             *   @2058ms "⏸ 运行中 · 点击暂停"    ← 本函数【又盖掉】
             * 本函数每轮都跑，而且【直接写 textContent】——
             * 完全绕过 updatePauseButtonHint，所以那层优先级拦不住它。
             *
             * 用户明确说「不开 F12」⇒ 按钮是守卫唯一的出口。
             * 被盖掉 = 用户看到「运行中」但脚本其实什么都没做 = 「脚本坏了」。
             *
             * ⚠️ 配色与 title 照常刷（它们不承载「为什么不动」），只保 textContent。
             *    新建元素时 pinnedHint 还是 0 ⇒ 初始文案照常设置，不会空白。 */
            /* 【v2.5.15】非学习页 → 文案钉成「本页不适用」，【不许】写「运行中」。
             *   判据同 v2.5.12c：本函数每轮都跑且直写 textContent，
             *   不在这里判就会 1 秒内被盖回「运行中」= 又对用户撒谎。
             *   ⚠️ 用局部 result（函数在下方定义，函数声明会提升，调用安全）。 */
            const _sc = pageScope();
            if (!_sc.run) {
                pauseBtnEl.textContent = '⏸ ' + (_sc.hint || '本页不适用');
                pinnedHint = 1;
            } else if (!pinnedHint) {
                pauseBtnEl.textContent = '⏸ 运行中 · 点击暂停';
            }
            pauseBtnEl.style.background = '#1f6feb';
            pauseBtnEl.style.color = '#fff';
            pauseBtnEl.title = '点击暂停所有自动功能（跳章 / 答题 / 讨论回复）';
        }
    }

    /* 按钮要显示「当前在做什么」——状态播报优先于功能开关。
     * 暂停时按钮必须能看出是按了暂停，否则用户会以为脚本坏了。
     *
     * 【v2.5.12b/c】加优先级 —— 修一个实测出来的真 bug：
     *   「测验页 · 不自动作答」「目录页 · 不自动跳章」这类一次性提示，
     *   实测**约 1 秒内就被常态文案盖掉，用户一个字都看不到**。
     *   用户明确说「不开 F12」⇒ 按钮是他唯一的入口，被盖掉就等于没播报。
     *
     *   ⚠️ 盖掉它的是**两个**地方，缺一不可（②只堵了第一个，实测无效）：
     *     ① updatePauseButtonHint('运行中 N/M')  —— 走本函数，被 pinnedHint 拦住；
     *     ② renderPauseButton() 里非暂停分支的**直接写 textContent** —— 绕过本函数，
     *        所以必须在 renderPauseButton 里也判 pinnedHint（见那边的注释）。
     *   定位手段：给 Node.prototype.textContent 打桩 + 打调用栈（_diag-pin2.mjs）。
     *
     *   0 = 常态信息（进度），可被覆盖；
     *   1 = 「说明脚本为什么不动」的一次性提示，设置后不被 0 覆盖。
     *   ⚠️ 同优先级仍可覆盖 —— 否则切章后目录页提示会一直挂着不更新。 */
    let pinnedHint = 0;
    function updatePauseButtonHint(extra, priority) {
        const w = Number(priority) || 0;
        if (!pauseBtnEl) return;
        if (paused) return;   // 暂停态文案固定，不覆盖
        if (w < pinnedHint) return;   // 低优先级不许盖掉高优先级
        pinnedHint = w;
        pauseBtnEl.textContent = extra ? '⏸ ' + extra : '⏸ 运行中 · 点击暂停';
        /* 【v2.5.20】面板镜像这个状态。
         * ⚠️ 必须写在 textContent 之后 —— 面板读的就是这一行。 */
        renderTopBar();
    }

    /* ============================================================
     *  【v2.5.20】顶部控制面板（可拖动 / 可最小化）
     *
     *  用户诉求：「置于网页顶部的、可以移动的、可以最小化的 ui」。
     *
     *  ── 为什么不替换右下角胶囊，而是共存 ──────────────────────
     *    ① 胶囊是既有行为契约：大量测试与文档盯着 `#gxb-helper-pause`，
     *       而且「暂停态强制显示」那条规则保证用户永远有恢复入口。
     *    ② 面板可以最小化、也可以整块关掉（菜单 ②）——
     *       若它是唯一入口，关掉之后用户就没法暂停/恢复了。
     *    ⇒ 面板 = 明细/日志（会收起）；胶囊 = 常驻的一键暂停。
     *
     *  ── ⚠️⚠️ 面板内部只用 <div>，且类名不含 "btn" ──────────────
     *    `findByText()` 的候选集是 `i, a, button, span, div[class*="btn"]`，
     *    文案表 BTN_TEXT 含【继续 / 完成 / 提交 / 关闭 / 播放 / 下一页】。
     *    ⇒ 面板里只要有一个 <span>继续</span>（≤8 字），
     *      findByText('player') 就会**返回面板元素**，脚本去点面板，
     *      站点那边什么都没发生 —— 表现为「视频不继续播放 / 弹题提交不了」，
     *      而且代码看着完全正确，**极难定位**。
     *    ⇒ 全 <div> + 类名避开 "btn" ⇒ findByText 永远看不到本面板。
     *      test-v2520.mjs 有断言守这个不变量（含行为验证）。
     *
     *  ── ⚠️ 面板里不许出现「还有 N 次」「有效提交次数」──────────
     *    `readAttemptsText()` 遍历 body * 按这两个模式抓站点文案，
     *    `readSubmittedState()` 也会在 body.innerText 上抓「还有 N 次」。
     *    面板若写了，就会被当成站点文案读走 ⇒ 次数播报出错。
     *    ⇒ 面板一律写「**还剩** N 次」。
     * ============================================================ */
    const TOPBAR_ID = 'gxb-helper-topbar';
    const TOPBAR_STYLE_ID = 'gxb-helper-topbar-style';
    let topBarEl = null;
    let topBarBodyEl = null;
    let topBarStatusEl = null;
    let topBarPauseEl = null;
    let topBarPos = readTopBarPos();
    let topBarMin = !!cfg('uiTopBarMin');
    let topBarDetailAt = 0;      // 明细上次刷新时间（节流用）
    /* 【v2.5.20c】拖动中标记。renderTopBar() 每秒跑一次，而「从没拖过」时
     * 它会重新居中 —— 不挡住的话，**拖到一半面板会自己弹回中间**。 */
    let topBarDragging = false;

    function readTopBarPos() {
        try {
            const raw = cfg('uiTopBarPos');
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (o && typeof o.left === 'number' && typeof o.top === 'number') return o;
        } catch (e) { /* 存的东西坏了就当没有，下次拖动会覆盖 */ }
        return null;
    }
    function saveTopBarPos() {
        if (!topBarEl) return;
        const l = parseFloat(topBarEl.style.left);
        const t = parseFloat(topBarEl.style.top);
        if (isNaN(l) || isNaN(t)) return;
        topBarPos = { left: Math.round(l), top: Math.round(t) };
        try { GM_setValue('uiTopBarPos', JSON.stringify(topBarPos)); } catch (e) {}
    }
    function saveTopBarMin() {
        try { GM_setValue('uiTopBarMin', !!topBarMin); } catch (e) {}
    }

    /* 面板样式走一个 <style> 而不是逐元素 cssText。
     * 理由：面板元素多（十几个），逐个写 cssText 既难读又容易漏；
     * 而 id 选择器特异性高，站点 CSS 很难覆盖到 `#gxb-helper-topbar ...`。
     * 关键布局属性加 !important —— 站点常用 `div{margin:0}` 这类通配规则。 */
    const TOPBAR_CSS = [
        '#' + TOPBAR_ID + '{position:fixed!important;top:0;left:0;z-index:2147483645!important;',
        'box-sizing:border-box!important;margin:0!important;padding:0!important;',
        'font:12px/1.55 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif!important;',
        'color:#1f2937!important;background:#ffffff!important;border:1px solid #cfd8e3!important;',
        'border-top:0!important;border-radius:0 0 10px 10px!important;',
        'box-shadow:0 6px 22px rgba(15,35,60,.22)!important;overflow:hidden!important;',
        'user-select:none!important;-webkit-user-select:none!important;text-align:left!important;',
        'max-width:min(520px,calc(100vw - 12px))!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-head{display:flex!important;align-items:center!important;',
        'gap:8px!important;padding:6px 10px!important;background:#1f6feb!important;color:#fff!important;',
        'cursor:move!important;touch-action:none!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-title{flex:0 0 auto!important;font-weight:600!important;',
        'white-space:nowrap!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-status{flex:1 1 auto!important;min-width:0!important;',
        'overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;',
        'opacity:.95!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-acts{flex:0 0 auto!important;display:flex!important;gap:6px!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-act{flex:0 0 auto!important;padding:1px 8px!important;',
        'border-radius:10px!important;background:rgba(255,255,255,.18)!important;',
        'cursor:pointer!important;white-space:nowrap!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-act:hover{background:rgba(255,255,255,.34)!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-body{padding:7px 10px 9px!important;}',
        '#' + TOPBAR_ID + '.gxb-tb-min .gxb-tb-body{display:none!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-row{display:flex!important;gap:8px!important;line-height:1.7!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-k{flex:0 0 34px!important;color:#6b7a8d!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-v{flex:1 1 auto!important;min-width:0!important;word-break:break-all!important;}',

        '#' + TOPBAR_ID + ' .gxb-tb-logs{margin-top:5px!important;padding-top:5px!important;',
        'border-top:1px dashed #dbe3ec!important;color:#4b5563!important;overflow:hidden!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-log{white-space:nowrap!important;overflow:hidden!important;',
        'text-overflow:ellipsis!important;}',

        /* ---- 【v2.5.22】设置视图 ----
         * ⚠️ 类名一个都不许含 "btn"（否则 div[class*="btn"] 会把面板
         *   交给 findByText 去点）。这里统一用 gxb-tb-act2 / gxb-tb-set 等。 */
        '#' + TOPBAR_ID + ' .gxb-tb-body{max-height:62vh!important;overflow:auto!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-sec{margin:8px 0 3px!important;padding-bottom:2px!important;',
        'border-bottom:1px solid #e6ecf3!important;color:#1f6feb!important;font-weight:600!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-sec:first-child{margin-top:0!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-set{display:flex!important;align-items:center!important;',
        'gap:6px!important;margin:3px 0!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-setlab{flex:0 0 96px!important;color:#4a5a6e!important;',
        'white-space:nowrap!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-setlab-wide{flex:1 1 auto!important;color:#1f2937!important;',
        'white-space:normal!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-in{flex:1 1 auto!important;min-width:0!important;',
        'padding:2px 5px!important;border:1px solid #cfd8e3!important;border-radius:4px!important;',
        'background:#fff!important;color:#1f2937!important;box-sizing:border-box!important;',
        'font:12px/1.5 -apple-system,"Microsoft YaHei",sans-serif!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-chk{flex:0 0 auto!important;margin:0!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-act2{display:inline-block!important;padding:2px 10px!important;',
        'margin:4px 0 2px!important;border-radius:10px!important;background:#1f6feb!important;',
        'color:#fff!important;cursor:pointer!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-act2:hover{background:#1558c0!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-danger{color:#c0392b!important;margin:0 0 4px!important;}',
        '#' + TOPBAR_ID + ' .gxb-tb-result{margin:2px 0 4px!important;color:#4b5563!important;',
        'white-space:pre-wrap!important;word-break:break-all!important;',
        'max-height:132px!important;overflow:auto!important;}',
    ].join('');

    function ensureTopBarStyle() {
        if (document.getElementById(TOPBAR_STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = TOPBAR_STYLE_ID;
        s.textContent = TOPBAR_CSS;
        (document.head || document.documentElement).appendChild(s);
    }

    /* 「脚本此刻在做什么」的**唯一真相**是右下角胶囊的文案。
     * ⚠️ 面板镜像它，不自己重算 —— 两处各算一次必然漂移（判据 30）。 */
    function topBarStatusText() {
        if (paused) return '已暂停';
        const sc = pageScope();
        if (!sc.run) return sc.hint || '本页不适用';
        const t = pauseBtnEl && pauseBtnEl.textContent ? String(pauseBtnEl.textContent) : '';
        const s = t.replace(/^[⏸▶]\s*/, '').trim();
        return s || '运行中';
    }

    /* 明细：页面类型 / 课程进度 / 开关摘要。
     * ⚠️ 这些值变化慢，且 chapterItems() 有成本 ⇒ 节流到 1.5s 一次，
     *   而状态行（topBarStatusText）每次都刷（要跟手）。 */
    function readTopBarProgress() {
        if (paused) return '已暂停（不跳章 / 不答题 / 不回复）';
        if (!pageScope().run) return '本页不跑自动功能';
        /* 【v2.5.20f】测验页**本来就没有章节目录** ⇒ 原先落到下面的
         *   「目录认不出（已降级）」，读起来像出错，其实完全正常。
         *   判据 29 的反面：**不是错误的事，别写成错误**。 */
        if (/\/quiz\/\d+/.test(location.pathname)) return '本页是整卷测验（无章节进度）';
        try {
            const items = chapterItems();
            const cur = currentNodeItem();
            const idx = cur ? items.indexOf(cur) : -1;
            if (idx < 0) return '目录认不出（已降级）';
            return '第 ' + (idx + 1) + ' / ' + items.length + ' 章' +
                (finishedHere ? ' · 已是最后一章' : '');
        } catch (e) {
            return '读取失败';
        }
    }

    function topBarSwitches() {
        const on = (k) => (cfg(k) ? '开' : '关');
        /* ⚠️ 文案里刻意不出现「还有 N 次 / 有效提交次数」——见模块头注释 ②。 */
        return '视频 ' + on('autoVideo') + ' · 跳章 ' + on('autoNext') +
            ' · 弹题 ' + on('autoQuiz') + ' · 整卷 ' +
            (cfg('autoQuizPaper') ? '★开' : '关');
    }

    function renderTopBarDetail() {
        if (!topBarBodyEl) return;

        /* 【v2.5.22】设置视图：**只构建一次**。
         *
         * ⚠️⚠️ 本函数被主循环每 1.5s 调一次，而下面的实现是
         *   「清空 body → 重建」。设置视图里一旦这么干，
         *   **用户正在输入框里打字时表单会被清空、输入全丢**。
         *   ⇒ 用 settingsBuilt 挡住重建（切换视图时 setTopBarView 会清掉它）。 */
        if (topBarView === 'settings') {
            if (settingsBuilt) return;
            settingsBuilt = true;
            buildSettings();
            return;
        }

        const sc = pageScope();
        const rows = [
            ['页面', sc.why || (sc.run ? '—' : '本页不适用')],
            ['进度', readTopBarProgress()],
            ['开关', topBarSwitches()],
        ];
        /* 【v2.5.21】已提交的测验：把成绩**放进正文**。
         *
         * 为什么：标题栏那行是【镜像右下角胶囊】的完整文案（一个真相），
         * 而标题栏宽度有限 ⇒ 长文案被省略号截掉，实测被吃掉的恰好是
         * 最关键的数字（「还剩 1 次」）：
         *     已完成 · 得分 100.00/100.00 分 · 5/5 题对 · 还…
         *
         * ⚠️ 不把标题栏改短 —— 那会造出**第二个真相**（判据 30）。
         *   正文行会折行、不截断，本来就该承担「标题放不下的细节」。
         *
         * ⚠️ readSubmittedState() 内部已按 URL 门控（非 /quiz/<id> 直接 null），
         *   所以放在这里每 1.5s 跑一次不会给别的页面增加开销。 */
        const sub = readSubmittedState();
        if (sub) rows.unshift(['成绩', formatSubmittedBar(sub)]);
        topBarBodyEl.textContent = '';
        for (const pair of rows) {
            const r = document.createElement('div');
            r.className = 'gxb-tb-row';
            const kd = document.createElement('div');
            kd.className = 'gxb-tb-k';
            kd.textContent = pair[0];
            const vd = document.createElement('div');
            vd.className = 'gxb-tb-v';
            vd.textContent = pair[1];
            r.appendChild(kd);
            r.appendChild(vd);
            topBarBodyEl.appendChild(r);
        }
        /* 最近日志 —— 用户不开 F12，这就是他的控制台 */
        const logs = document.createElement('div');
        logs.className = 'gxb-tb-logs';
        const last = logRing.slice(-5);
        const lines = last.length ? last : ['（暂无日志）'];
        for (const line of lines) {
            const ld = document.createElement('div');
            ld.className = 'gxb-tb-log';
            ld.textContent = line;
            ld.title = line;      // 被截断时悬停看全文
            logs.appendChild(ld);
        }
        topBarBodyEl.appendChild(logs);
    }

    function mkTopBarAct(act, text) {
        const el = document.createElement('div');
        el.className = 'gxb-tb-act';
        el.setAttribute('data-gxb-nodrag', '1');
        el.setAttribute('data-gxb-act', act);
        el.textContent = text;
        /* ⚠️ capture + stopPropagation：面板叠在站点内容上，
         *   点击不该被站点的 document 级监听器当成「页面被点了」。 */
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (act === 'pause') setPaused(!paused);
            else if (act === 'min') toggleTopBarMin();
            /* 【v2.5.22】设置 / 返回：同一个按钮切换视图 */
            else if (act === 'cfg') {
                setTopBarView(topBarView === 'settings' ? 'status' : 'settings');
            }
        }, true);
        return el;
    }

    function toggleTopBarMin() {
        topBarMin = !topBarMin;
        saveTopBarMin();
        if (topBarEl) {
            topBarEl.classList.toggle('gxb-tb-min', topBarMin);
            /* 高度变了 ⇒ 重新夹取，别让面板（尤其是贴在底边时）被挤出屏幕 */
            applyTopBarPos(currentTopBarPos(), false);
        }
        log('顶部面板已' + (topBarMin ? '最小化' : '展开'));
        renderTopBar();
    }

    /* ============================================================
     *  【v2.5.22】面板内的「设置」视图
     *  原来在篡改猴菜单里的配置项全部搬到这里（菜单只留面板相关的几条）。
     *
     *  ── 为什么用数据表驱动 ──────────────────────────────────
     *    设置项有 20 来个，逐条手写 DOM 既长又容易漏。
     *    加一项只改 TOPBAR_SETTINGS 一处。
     *
     *  ── ⚠️ 类名一个都不许含 "btn" ───────────────────────────
     *    findByText() 的候选集含 `div[class*="btn"]`。
     *    我第一版把按钮类名写成 gxb-tb-btn2 —— 那正好落进候选集，
     *    等于把「测试 AI 连接」六个字送给 findByText 去点。
     *    ⇒ 统一 gxb-tb-act2。
     * ============================================================ */

    let topBarView = 'status';        // 'status' | 'settings'
    let settingsBuilt = false;        // 设置表单是否已构建（构建后【不再重建】）
    let topBarCfgActEl = null;        // 头部「设置 / 返回」按钮
    let topBarTestResultEl = null;    // 连接测试结果行

    const TOPBAR_SETTINGS = [
        { s: 'AI 接口' },
        { t: 'preset' },
        { t: 'text', k: 'apiUrl', label: 'API 地址', ph: 'https://…/chat/completions' },
        { t: 'secret', k: 'apiKey', label: 'API Key', ph: '存在浏览器本地' },
        { t: 'text', k: 'model', label: '模型名', ph: 'deepseek-chat' },
        { t: 'test' },

        { s: '功能开关' },
        { t: 'bool', k: 'autoVideo', label: '自动播放视频' },
        { t: 'bool', k: 'autoNext', label: '自动跳下一章' },
        { t: 'bool', k: 'skipNonVideo', label: '非视频章节自动跳过' },
        { t: 'bool', k: 'antiBlur', label: '失焦防暂停' },
        { t: 'bool', k: 'autoQuiz', label: '自动答题（视频弹题）' },
        { t: 'bool', k: 'debug', label: '调试日志（控制台）' },

        { s: '测验 / 作业' },
        { t: 'sel', k: 'quizChapterMode', label: '测验/作业章节',
          opts: [['skip', '跳过'], ['answer', '先答完再跳']] },
        { t: 'bool', k: 'autoQuizPaper', label: '测验自动作答',
          danger: '★不可撤销：会真的替你交卷，烧掉一次答题机会' },

        { s: '讨论区' },
        { t: 'sel', k: 'topicMode', label: '讨论题处理',
          opts: [['skip', '跳过'], ['copy', '抄答案'], ['api', '接入 API']] },

        { s: '界面' },
        { t: 'bool', k: 'showPauseBtn', label: '显示右下角暂停按钮' },
        { t: 'bool', k: 'showTopBar', label: '显示顶部控制面板' },
        { t: 'act', a: 'resetPos', label: '重置面板位置' },
    ];

    function mkDiv(cls) {
        const d = document.createElement('div');
        d.className = cls;
        return d;
    }

    function buildSettings() {
        if (!topBarBodyEl) return;
        const body = topBarBodyEl;
        body.textContent = '';
        topBarTestResultEl = null;

        for (const it of TOPBAR_SETTINGS) {
            if (it.s) {
                const h = mkDiv('gxb-tb-sec');
                h.textContent = it.s;
                body.appendChild(h);
                continue;
            }

            if (it.t === 'preset') {
                const row = mkDiv('gxb-tb-set');
                const lab = mkDiv('gxb-tb-setlab');
                lab.textContent = '服务商预设';
                const sel = document.createElement('select');
                sel.className = 'gxb-tb-in';
                sel.setAttribute('data-gxb-preset', '1');
                const none = document.createElement('option');
                none.value = '';
                none.textContent = '（手动填写）';
                sel.appendChild(none);
                for (const p of API_PRESETS) {
                    const o = document.createElement('option');
                    o.value = p.id;
                    o.textContent = p.name;
                    sel.appendChild(o);
                }
                sel.value = cfg('apiPreset') || '';
                row.appendChild(lab);
                row.appendChild(sel);
                body.appendChild(row);
                continue;
            }

            if (it.t === 'text' || it.t === 'secret') {
                const row = mkDiv('gxb-tb-set');
                const lab = mkDiv('gxb-tb-setlab');
                lab.textContent = it.label;
                const inp = document.createElement('input');
                inp.className = 'gxb-tb-in';
                inp.type = it.t === 'secret' ? 'password' : 'text';
                inp.setAttribute('data-gxb-cfg', it.k);
                inp.value = cfg(it.k) || '';
                if (it.ph) inp.placeholder = it.ph;
                row.appendChild(lab);
                row.appendChild(inp);
                body.appendChild(row);
                continue;
            }

            if (it.t === 'bool') {
                const row = mkDiv('gxb-tb-set');
                const box = document.createElement('input');
                box.className = 'gxb-tb-chk';
                box.type = 'checkbox';
                box.setAttribute('data-gxb-cfg', it.k);
                box.checked = !!cfg(it.k);
                const lab = mkDiv('gxb-tb-setlab gxb-tb-setlab-wide');
                lab.textContent = it.label;
                row.appendChild(box);
                row.appendChild(lab);
                body.appendChild(row);
                if (it.danger) {
                    const w = mkDiv('gxb-tb-danger');
                    w.textContent = it.danger;
                    body.appendChild(w);
                }
                continue;
            }

            if (it.t === 'sel') {
                const row = mkDiv('gxb-tb-set');
                const lab = mkDiv('gxb-tb-setlab');
                lab.textContent = it.label;
                const sel = document.createElement('select');
                sel.className = 'gxb-tb-in';
                sel.setAttribute('data-gxb-cfg', it.k);
                for (const pair of it.opts) {
                    const o = document.createElement('option');
                    o.value = pair[0];
                    o.textContent = pair[1];
                    sel.appendChild(o);
                }
                sel.value = cfg(it.k);
                row.appendChild(lab);
                row.appendChild(sel);
                body.appendChild(row);
                continue;
            }

            if (it.t === 'test') {
                const b = mkDiv('gxb-tb-act2');
                b.setAttribute('data-gxb-act2', 'test');
                b.textContent = '测试 AI 连接';
                const res = mkDiv('gxb-tb-result');
                res.textContent = '（未测试）';
                body.appendChild(b);
                body.appendChild(res);
                topBarTestResultEl = res;
                continue;
            }

            if (it.t === 'act') {
                const b = mkDiv('gxb-tb-act2');
                b.setAttribute('data-gxb-act2', it.a);
                b.textContent = it.label;
                body.appendChild(b);
            }
        }
    }

    function panelCtl(key) {
        return topBarBodyEl
            ? topBarBodyEl.querySelector('[data-gxb-cfg="' + key + '"]')
            : null;
    }
    function setPanelInput(key, val) {
        const el = panelCtl(key);
        if (el && el.value !== val) el.value = val;
    }
    function setPanelCheck(key, val) {
        const el = panelCtl(key);
        if (el && el.checked !== !!val) el.checked = !!val;
    }
    function setPanelResult(txt) {
        if (topBarTestResultEl) topBarTestResultEl.textContent = String(txt);
    }

    /* 面板里所有控件的变化都走这里（body 上捕获阶段委托）。
     * ⚠️ 不用在每个控件上挂 change —— 那样会被 body 的捕获 stopPropagation 挡掉。 */
    function onPanelChange(t) {
        if (!t || !t.getAttribute) return;

        /* ---- 服务商预设：选了就自动填地址 + 模型名 ---- */
        if (t.getAttribute('data-gxb-preset')) {
            const id = t.value;
            const p = API_PRESETS.filter((x) => x.id === id)[0];
            if (!p) { GM_setValue('apiPreset', ''); return; }
            GM_setValue('apiPreset', p.id);
            GM_setValue('apiUrl', p.url);
            if (p.model) GM_setValue('model', p.model);
            /* 同步刷新输入框，别让界面和实际值不一致 */
            setPanelInput('apiUrl', p.url);
            if (p.model) setPanelInput('model', p.model);
            log('已应用服务商预设：' + p.name);
            setPanelResult('已填入：' + p.url + '\n还需要填 API Key，然后点「测试 AI 连接」。');
            return;
        }

        const key = t.getAttribute('data-gxb-cfg');
        if (!key) return;

        if (t.type === 'checkbox') {
            /* ⚠️ 「测验自动作答」是唯一不可撤销的功能 —— 打开前必须确认。
             *   关掉也提醒一句：用户可能只是临时停一下。 */
            if (key === 'autoQuizPaper' && t.checked) {
                const ok = confirm(
                    '⚠️ 打开「测验自动作答」后，脚本会真的替你交卷。\n\n' +
                    '每套测验只有 1~3 次机会，交一次少一次，而且【不可撤销】。\n' +
                    'AI 的答案不保证正确 —— 对只剩 1 次机会的套，答错就是该章 0 分。\n\n' +
                    '确定要打开吗？'
                );
                if (!ok) { t.checked = false; return; }
            }
            if (key === 'showTopBar' && !t.checked) {
                const ok = confirm(
                    '隐藏顶部控制面板后，可以从篡改猴菜单「② 顶部控制面板：显示 / 隐藏」再打开。\n\n' +
                    '确定隐藏吗？'
                );
                if (!ok) { t.checked = true; return; }
            }
            GM_setValue(key, t.checked);
            log('设置：' + key + ' = ' + t.checked);
            if (key === 'showTopBar') renderTopBar();
            if (key === 'showPauseBtn') renderPauseButton();
            return;
        }

        GM_setValue(key, t.value);
        log('设置：' + key + ' = ' + t.value);

        /* 测验章「先答完再跳」依赖答题链路 —— 答题关着时提醒一次 */
        if (key === 'quizChapterMode' && t.value === 'answer' && !cfg('autoQuiz')) {
            if (confirm(
                '提示：「自动答题」当前是关闭的。\n\n' +
                '「先答完再跳」需要答题功能配合，否则测验 / 作业章会一直等到超时才跳。\n\n' +
                '要顺便打开「自动答题」吗？'
            )) {
                GM_setValue('autoQuiz', true);
                setPanelCheck('autoQuiz', true);
            }
        }
    }

    function runPanelAction(a) {
        if (a === 'test') { runPanelApiTest(); return; }
        if (a === 'resetPos') {
            GM_setValue('uiTopBarPos', '');
            topBarPos = null;
            if (topBarEl) applyTopBarPos(null, true);
            setPanelResult('面板位置已重置为「顶部居中」。');
        }
    }

    async function runPanelApiTest() {
        setPanelResult('测试中…（两步：先短问题，再按整卷形状）');
        /* 把结果写进面板 —— 用户不开 F12，也不该被 alert 打断 */
        await testApiConnection({ say: (m) => setPanelResult(m) });
    }

    function setTopBarView(v) {
        topBarView = v;
        settingsBuilt = false;                       // 允许重建一次
        if (topBarCfgActEl) topBarCfgActEl.textContent = (v === 'settings' ? '返回' : '设置');
        if (topBarBodyEl) topBarBodyEl.textContent = '';
        renderTopBarDetail();
        /* 宽度/高度变了 ⇒ 重新定位（没拖过就重新居中） */
        if (topBarEl) applyTopBarPos(topBarPos, topBarPos === null);
    }

    function currentTopBarPos() {
        if (!topBarEl) return null;
        const l = parseFloat(topBarEl.style.left);
        const t = parseFloat(topBarEl.style.top);
        if (isNaN(l) || isNaN(t)) return null;
        return { left: l, top: t };
    }

    /* 定位 + 夹取。
     * ⚠️ 必须夹取：窗口变小 / 最小化改变高度后，旧坐标可能让面板整体跑到视口外
     *   ⇒ 用户看到面板「消失了」，而且**没有任何办法拖回来**（拖把手也在屏幕外）。 */
    function applyTopBarPos(pos, isInit) {
        if (!topBarEl) return;
        const w = topBarEl.offsetWidth;
        const h = topBarEl.offsetHeight;
        let left, top;
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
            left = pos.left;
            top = pos.top;
        } else if (isInit) {
            /* 默认：**贴顶 + 水平居中**（用户要求「置于网页顶部」） */
            left = Math.round((window.innerWidth - w) / 2);
            top = 0;
        } else {
            const cur = currentTopBarPos();
            left = cur ? cur.left : 0;
            top = cur ? cur.top : 0;
        }
        const maxL = Math.max(0, window.innerWidth - w);
        const maxT = Math.max(0, window.innerHeight - h);
        topBarEl.style.left = Math.min(Math.max(0, left), maxL) + 'px';
        topBarEl.style.top = Math.min(Math.max(0, top), maxT) + 'px';
    }

    function installTopBarDrag(head) {
        let dragging = false, moved = false, swallowClick = false;
        let sx = 0, sy = 0, ox = 0, oy = 0, pid = null;

        const onDown = (e) => {
            if (e.button !== undefined && e.button !== 0) return;   // 只认左键
            const t = e.target;
            /* 按钮区不参与拖动（否则点「暂停」会先被拖走） */
            if (t && t.closest && t.closest('[data-gxb-nodrag]')) return;
            dragging = true;
            moved = false;
            topBarDragging = true;
            pid = e.pointerId;
            sx = e.clientX; sy = e.clientY;
            const r = topBarEl.getBoundingClientRect();
            ox = r.left; oy = r.top;
            try { head.setPointerCapture(e.pointerId); } catch (_e) {}
            e.preventDefault();
            e.stopPropagation();
        };
        const onMove = (e) => {
            if (!dragging) return;
            /* 2px 阈值：手抖不该算「拖动」，否则单纯点一下标题栏
             * 也会被当成拖动，并连带吞掉那个 click。 */
            if (Math.abs(e.clientX - sx) > 2 || Math.abs(e.clientY - sy) > 2) moved = true;
            const w = topBarEl.offsetWidth, h = topBarEl.offsetHeight;
            const maxL = Math.max(0, window.innerWidth - w);
            const maxT = Math.max(0, window.innerHeight - h);
            topBarEl.style.left = Math.min(Math.max(0, ox + e.clientX - sx), maxL) + 'px';
            topBarEl.style.top = Math.min(Math.max(0, oy + e.clientY - sy), maxT) + 'px';
            e.preventDefault();
            e.stopPropagation();
        };
        const onUp = (e) => {
            if (!dragging) return;
            dragging = false;
            topBarDragging = false;
            try { head.releasePointerCapture(pid); } catch (_e) {}
            if (moved) {
                /* 【v2.5.20c】拖动后浏览器还会补发一个 click，而它是**另一个事件**
                 *   —— 在 pointerup 里 stopPropagation 拦不住。
                 *   不吞掉的话，拖一下面板就等于「点了一下页面」，
                 *   站点的 document 级点击监听会被误触发。
                 *   ⚠️ 只在「真的拖动过」时吞：否则面板上的按钮就点不动了。 */
                swallowClick = true;
                /* 400ms 兜底：万一这次没补 click，别让标记挂在那儿
                 * 把**下一次**正常的按钮点击吞掉。 */
                setTimeout(() => { swallowClick = false; }, 400);
                saveTopBarPos();      // 松手才写存储（拖动中每帧写会伤性能）
            }
            e.stopPropagation();
        };
        head.addEventListener('pointerdown', onDown, true);
        head.addEventListener('pointermove', onMove, true);
        head.addEventListener('pointerup', onUp, true);
        head.addEventListener('pointercancel', onUp, true);
        /* 吞掉「拖动产生的那个 click」。
         * ⚠️ 注册在 head 的**捕获阶段**：它比子元素（按钮）的监听器先跑，
         *   所以标记为真时能拦住；标记为假时【什么都不做】，
         *   按钮的点击照常传下去。 */
        head.addEventListener('click', (e) => {
            if (!swallowClick) return;
            swallowClick = false;
            e.stopPropagation();
            e.preventDefault();
        }, true);
    }

    function buildTopBar() {
        const d = document.createElement('div');
        d.id = TOPBAR_ID;

        const head = document.createElement('div');
        head.className = 'gxb-tb-head';

        const title = document.createElement('div');
        title.className = 'gxb-tb-title';
        title.textContent = '高校邦助手 v' + SCRIPT_VERSION;

        const status = document.createElement('div');
        status.className = 'gxb-tb-status';
        status.textContent = '运行中';

        const acts = document.createElement('div');
        acts.className = 'gxb-tb-acts';
        /* 【v2.5.22】顺序：设置 / 暂停 / 最小化 */
        const cfgAct = mkTopBarAct('cfg', '设置');
        const pauseAct = mkTopBarAct('pause', '⏸ 暂停');
        const minAct = mkTopBarAct('min', '最小化');
        acts.appendChild(cfgAct);
        acts.appendChild(pauseAct);
        acts.appendChild(minAct);

        head.appendChild(title);
        head.appendChild(status);
        head.appendChild(acts);

        const body = document.createElement('div');
        body.className = 'gxb-tb-body';

        d.appendChild(head);
        d.appendChild(body);
        document.body.appendChild(d);

        topBarEl = d;
        topBarBodyEl = body;
        topBarStatusEl = status;
        topBarPauseEl = pauseAct;
        topBarCfgActEl = cfgAct;
        settingsBuilt = false;      // 新 DOM ⇒ 设置表单要重建
        topBarTestResultEl = null;

        /* 【v2.5.22】把 body 里的交互**隔离**掉，别泄漏给站点。
         *
         * ⚠️ 为什么必须有：设置视图里有输入框，而站点几乎肯定有全局键盘快捷键
         *   （**空格 = 播放/暂停视频** 是最常见的）。用户往 API Key 里打一个空格，
         *   视频就可能被切了 —— 和「拖动泄漏 click」是同一类问题（判据 40 的兄弟）。
         *
         * ⚠️ 用**捕获 + 委托**集中处理，不要在每个控件上单独挂监听 ——
         *   挂在控件上的监听会被这里的捕获 stopPropagation **挡掉**（本项目踩过）。
         *
         * ⚠️ 只挂 body，**不挂 root** —— 挂 root 会让 head 的拖动监听被挡掉。 */
        ['keydown', 'keyup', 'keypress', 'input', 'pointerdown', 'mousedown', 'wheel']
            .forEach((t) => body.addEventListener(t, (e) => e.stopPropagation(), true));
        body.addEventListener('change', (e) => {
            onPanelChange(e.target);
            e.stopPropagation();
        }, true);
        body.addEventListener('click', (e) => {
            const t = e.target;
            const act = t && t.closest ? t.closest('[data-gxb-act2]') : null;
            if (act) runPanelAction(act.getAttribute('data-gxb-act2'));
            e.stopPropagation();
        }, true);

        installTopBarDrag(head);
        /* 先把正文画出来，再交给 renderTopBar() 统一去定位。
         *
         * ⚠️ 这里【不】自己调 applyTopBarPos —— 定位**只留一个地方负责**。
         *   原因是实测出来的：面板是 shrink-to-fit（position:fixed 且不设 width），
         *   宽度由内容决定；正文还空着时量出来的宽度比最终窄 ⇒ 按它居中会偏
         *   （实测偏 11px）。而 renderTopBar() 末尾**总会**再定位一次，
         *   那次正文已经画好了 ⇒ 这里这次是**死代码**（永远被立刻覆盖）。
         *   变异测试 m6 就是靠这一点存活的 —— 存活的变异体说「这段代码没用」，
         *   这次它说对了。与其留着，不如收敛到一处。 */
        renderTopBarDetail();
    }

    function renderTopBar() {
        /* 菜单 ② 关掉 ⇒ 整块移除（同 showPauseBtn 的写法） */
        if (!cfg('showTopBar')) {
            if (topBarEl && document.body.contains(topBarEl)) topBarEl.remove();
            topBarEl = null;
            topBarBodyEl = null;
            topBarStatusEl = null;
            topBarPauseEl = null;
            return;
        }
        if (!document.body) return;      // 文档还没就绪，下一轮再画

        if (!topBarEl || !document.body.contains(topBarEl)) {
            ensureTopBarStyle();
            buildTopBar();
        }

        /* 状态：镜像胶囊（唯一真相）。只在**变了**才写，避免每帧无谓重绘。 */
        const st = topBarStatusText();
        if (topBarStatusEl && topBarStatusEl.textContent !== st) {
            topBarStatusEl.textContent = st;
            /* 【v2.5.21】标题栏窄 ⇒ 长文案被省略号截断。加 title，
             *   鼠标悬停能看全文（正文里另有明细行，这是快捷方式）。 */
            topBarStatusEl.title = st;
        }

        if (topBarEl.classList.contains('gxb-tb-min') !== topBarMin) {
            topBarEl.classList.toggle('gxb-tb-min', topBarMin);
        }

        const pauseTxt = paused ? '▶ 恢复' : '⏸ 暂停';
        if (topBarPauseEl && topBarPauseEl.textContent !== pauseTxt) {
            topBarPauseEl.textContent = pauseTxt;
        }

        const now = Date.now();
        if (now - topBarDetailAt >= 1500) {
            topBarDetailAt = now;
            renderTopBarDetail();
        }

        /* ---- 定位 ----
         * ⚠️ 这里【不能】用早退（return）跳过：定位必须每轮都走一遍。
         *
         * · 从没拖过（topBarPos 为 null）⇒ 每轮保持「贴顶居中」。
         *   为什么不只算一次：面板宽度是 shrink-to-fit，会随状态文案变化
         *   （「运行中」→「已完成 · 得分 …」），只算一次就会一直偏着。
         * · 拖过 ⇒ 用户的坐标是权威，只做夹取，绝不自作主张挪回去。
         *   （菜单 ③ 会把 topBarPos 清回 null ⇒ 回到自动居中。）
         * · 拖动进行中 ⇒ 跳过，否则每秒一次的居中会把面板**从手里拽回去**。
         *
         * 两种都走 applyTopBarPos —— 它内部会夹取，防面板被挤出视口。 */
        /* ★ 全脚本【唯一】给面板定位的地方。
         *   ⚠️ 必须在写完状态文案之后 —— 文案会改变面板宽度（shrink-to-fit），
         *      定位要用最终宽度算居中。 */
        if (!topBarDragging) applyTopBarPos(topBarPos, topBarPos === null);
    }

    /* 窗口尺寸变化 → 重新夹取（否则面板可能停在视口外） */
    window.addEventListener('resize', () => {
        if (topBarEl) applyTopBarPos(currentTopBarPos(), false);
    });

    /* 【v2.5.20】把「为什么不动」的 warn 也收进面板日志。
     * ⚠️ 只收带 [高校邦助手] 前缀的 —— 站点自己的 warn 不该混进用户的日志里。 */
    (function wrapWarnForTopBar() {
        const orig = console.warn;
        console.warn = function (...a) {
            try {
                const s = a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ');
                if (s.indexOf('[高校邦助手]') >= 0) {
                    pushLogRing(s.replace(/\[高校邦助手\]\s*/g, '').trim());
                }
            } catch (e) { /* 记日志失败绝不影响 warn 本身 */ }
            return orig.apply(console, a);
        };
    })();

    // UEditor 正文在 iframe 里
    function getEditorBody() {
        const frame = q('#ueditor_0');
        try {
            return frame && frame.contentDocument ? frame.contentDocument.body : null;
        } catch (e) {
            return null; // 跨域等情况
        }
    }

    // 纯文本写入 UEditor：逐段 textContent，避免 AI 内容里的标签被当 HTML 解析
    function setEditorText(text) {
        const body = getEditorBody();
        if (!body) return false;
        body.innerHTML = '';
        const doc = body.ownerDocument;
        const lines = String(text).split(/\n+/).map((s) => s.trim()).filter(Boolean);
        (lines.length ? lines : [String(text)]).forEach((line) => {
            const p = doc.createElement('p');
            p.textContent = line;
            body.appendChild(p);
        });
        try {
            body.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) {}
        return true;
    }

    // 点击「回复」提交
    function submitReply() {
        const btn = q('.post-submit');
        if (visible(btn)) {
            btn.click();
            return true;
        }
        return false;
    }

    // 统一用 GM_xmlhttpRequest 发请求（绕跨域 + 自动带 cookie）
    function gmRequest({ method = 'POST', url, headers = {}, data, timeout = 20000 }) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method,
                url,
                headers,
                data,
                timeout,
                onload: (r) => resolve(r),
                onerror: () => reject(new Error('网络请求失败: ' + url)),
                ontimeout: () => reject(new Error('请求超时: ' + url)),
            });
        });
    }

    /* ============================================================
     *  三、AI 调用（OpenAI 兼容，通用）
     * ============================================================ */

    /* ============================================================
     *  【v2.5.6】回复语言跟随题目
     *
     *  起因：用户接 DeepSeek 后，**英文讨论题被答成了中文**。
     *  根因不在模型，在提示词：基础 systemPrompt 整段是中文，
     *  还写着「80~150 字」——模型当然用中文答。
     *
     *  这里做三件事：
     *    detectLang  判题目语言
     *    langClause  按语言生成「语言要求」补丁，追加到 system 消息末尾
     *    langMismatch 生成后校验，不一致就重试一次（再不行就停下不提交）
     * ============================================================ */

    const LANG_CN = { zh: '中文', en: '英文', unknown: '未知' };

    /* 判题目语言：按【中文字符占比】。
     * 纯中文题、纯英文题都很准；中英混排按占比判。
     * ⚠️ 阈值定在 20% 而不是 50%：英文题里偶尔夹一个中文词（人名、术语）
     *    不该把整道题判成中文题。反过来，中文题里夹几个英文单词，
     *    中文占比通常仍远高于 20%。 */
    function detectLang(text) {
        const s = String(text || '');
        const cjk = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
        const letters = (s.match(/[A-Za-z]/g) || []).length;
        if (!cjk && !letters) return 'unknown';   // 全是数字/符号，判不出来
        if (!letters) return 'zh';
        if (!cjk) return 'en';
        return (cjk / (cjk + letters)) > 0.2 ? 'zh' : 'en';
    }

    /* 按题目语言生成「语言要求」补丁，追加在 system 消息末尾。
     * ⚠️ 长度要求必须按语言分开写：英文按【词】算，中文按【字】算。
     *    只写「80~150 字」是错的 —— 英文 150 个字符连一句话都不到。 */
    function langClause(lang) {
        if (lang === 'en') {
            return '\n\n【语言要求】这个话题是英文的，你的回复必须【全部用英文】写，' +
                '不得出现任何中文字符。长度 60~120 个英文单词。';
        }
        if (lang === 'zh') {
            return '\n\n【语言要求】这个话题是中文的，用中文回复，80~150 字。';
        }
        return '\n\n【语言要求】用与讨论话题相同的语言回复。';
    }

    /* 生成后校验：回复语言与题目是否不一致。
     *
     * ⚠️ 判据要「宁可放过、不可错杀」，否则会把正常回复反复重试：
     *   · 英文题：出现【任何一个】中文字符就算不一致 ——
     *     英文回复里冒出中文，几乎一定是模型没听话，误判概率极低。
     *   · 中文题：要【几乎没有中文】且英文很多才算不一致 ——
     *     中文回复里夹英文术语（PPT / marketing / GDP）非常正常，
     *     按「有英文就算错」判会把正常回复全部重试掉。
     *   · 判不出题目语言（unknown）→ 一律不判，直接放过。 */
    function langMismatch(lang, reply) {
        const s = String(reply || '');
        const cjk = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
        const letters = (s.match(/[A-Za-z]/g) || []).length;
        if (lang === 'en') return cjk > 0;
        if (lang === 'zh') return cjk < 5 && letters > 20;
        return false;
    }

    /* 【v2.5.10】额度阶梯：普通回复 500 够；推理模型会把额度花在「思考」上，
     *   而「思考要花多少」**无法预知**（同一模型换个题目就不同）——
     *   所以不再只放大一级，而是 500 → 2000 → 6000 逐级试，**拿到正文就停**。
     *
     *   v2.5.9 只有 500 → 2000 一级，实测很容易被思考吃光 → 用户仍然卡住。
     *   代价可控：只在【失败路径】上多花请求；正常回复仍然只发一次（T1 有断言）。 */
    const AI_MAX_TOKENS_LADDER = [500, 2000, 6000];

    /* 【v2.5.18】关闭「思考模式」的请求体片段。
     *
     * 为什么必须有它（用户实测 + 官方文档双证）：
     *   用户原始响应里有 `"reasoning_content": "We need answer JSON only…"`
     *   而 `"content": ""` —— 思考把 max_tokens 吃光了，正文没写出来。
     *
     * 官方《思考模式》文档原文：
     *   · 「思考模式**默认打开**，且 effort 默认为 high」
     *   · 控制参数（OpenAI 格式）：{"thinking": {"type": "enabled/disabled"}}
     *   · 文档示例的模型名恰好就是 `deepseek-flash`（用户踩的就是这个默认值）
     *
     * ⚠️ 关键认知修正：`reasoning_content` 是【服务端行为】不是【模型属性】。
     *   旧版诊断把「有 reasoning_content」当成「这模型是推理模型」——
     *   于是建议「换个非推理模型」。用户照做换了 `deepseek-flash`，**问题依旧**，
     *   因为这个模型名字里没有推理字样、思考却是默认开的。
     *   ⇒ 换模型可能碰巧绕开，但不是治本；发 `thinking: disabled` 才是。
     *
     * 兼容性：不支持的平台会**忽略**未知字段（OpenAI 兼容接口的惯例），
     *   少数平台可能报 400 —— 那种情况下把 disableThinking 关掉即可（见 cfg）。
     * 附带收益：思考模式不支持 temperature（官方文档明说），
     *   关掉思考后脚本传的 temperature 才真正生效。 */
    const THINKING_DISABLED_BODY = { thinking: { type: 'disabled' } };

    /* 【v2.5.10】「怎么换掉推理模型」这句建议两个分支都要用，抽出来免得两处写法漂移。
     *
     *   ⚠️ 这句建议只能写【用户在这个脚本里做得到的】动作。
     *    第一版写的是「请把它的思考关掉（请求里传 enable_thinking=false）」——
     *    可本脚本不支持自定义请求参数，用户照这句话**什么都做不了**。
     *    给一个做不到的动作，比不给更让人火大。
     *    ⇒ 第 ① 条人人可做（面板「设置」 改模型名）；
     *      第 ② 条写清前提，不假装脚本能传参。 */
    /* 【v2.5.18】三条建议的排序与内容都改了。
     *   旧版本把「换个非推理模型」当第 ① 条 —— 用户照做后**没有解决**，
     *   因为思考模式是**服务端默认开启**的，换模型名绕不过去。
     *   现在第 ① 条是「修好开关」（本脚本已默认帮你做了），
     *   「换模型」降级为兜底的第 ③ 条。 */
    const ADVICE_DISABLE_THINKING =
        '建议：① 本版已默认【关闭思考模式】（脚本会自动带上 thinking: disabled）；' +
        '② 若仍失败，去菜单里把「关闭思考模式」重新开一次再试（可能是页面缓存了旧脚本）；' +
        '③ 仍不行才考虑换模型 —— 换成 deepseek-chat（对话版）或 qwen-plus。';

    /* 保留这个名字：别的地方（判断分支）还在引用，替换成新文案以避免漏改。 */
    const ADVICE_SWITCH_MODEL = ADVICE_DISABLE_THINKING;

    /* 没开思考、纯粹是额度给小了 —— 这种情况「换模型」是错的建议。 */
    const ADVICE_BIGGER_BUDGET =
        '建议：这次不是思考吃掉的额度。请在面板「设置」 把 max_tokens 调大，' +
        '或换一个上下文更长的模型。';

    /* 【v2.5.9】把「HTTP 200 通了、却取不到正文」翻译成【能照着做的结论】。
     *
     * 原来的实现只抛一句 '返回内容为空' —— 用户实测就卡在这里，
     * 而且面板「设置」 给的「常见原因」（Key 错 / 模型名错 / 地址错）在本场景下**全是错的**
     * （HTTP 明明通了）。没有证据的错误信息 = 让人瞎猜。
     * 所以这里把能定性的东西全带上：finish_reason、有没有 reasoning_content、原始响应片段。 */
    /* tried：本次在额度阶梯上试过的额度列表。用户需要知道「自愈已经尽力了」，
     *   否则看到的还是「失败」两个字，没法判断该不该再折腾。 */
    function explainEmptyReply(d, raw, tried) {
        const choice = (d && d.choices && d.choices[0]) || null;
        const fr = (choice && choice.finish_reason) || '';
        const msg = (choice && choice.message) || {};
        const hasReasoning = !!(msg.reasoning_content || msg.reasoning);
        const out = ['返回内容为空（HTTP 200 通了，但正文取不到）'];

        if (fr === 'length') {
            /* 【v2.5.18】因果链修正：不再说「这个模型是【推理模型】」。
             *   实证：用户用 `deepseek-flash`（名字里没有推理字样）照样返回
             *   reasoning_content —— 因为「思考模式**默认打开**」（官方文档原文），
             *   这是**服务端行为**，跟模型名无关。旧表述让用户白白换了一轮模型。 */
            out.push('原因：输出被 max_tokens 用完了（finish_reason=length）' +
                (hasReasoning ? ' —— 额度在【思考阶段】就被耗尽了' : ''));
            out.push(hasReasoning ? ADVICE_DISABLE_THINKING : ADVICE_BIGGER_BUDGET);
        } else if (fr === 'content_filter') {
            out.push('原因：被服务商的内容审核拦下了（finish_reason=content_filter）。换个模型或换个说法试试。');
        } else if (hasReasoning) {
            /* 【v2.5.18】同上：把「推理模型」这个错误标签去掉，只陈述观察到的事实。 */
            out.push('原因：服务端把正文放进了 reasoning_content（思考字段），content 为空 —— ' +
                '【思考模式】把额度用掉了（注意：这是服务端的开关，换个模型名不一定有用）。');
            out.push(ADVICE_DISABLE_THINKING);
        } else {
            out.push('原因：响应不是 OpenAI 格式（脚本按 choices[0].message.content 取正文）。');
            out.push('多半是地址填错了端点，或该平台返回的是自有格式。');
        }
        if (tried && tried.length > 1) {
            out.push('已自动放大额度重试 ' + (tried.length - 1) + ' 次（' +
                tried.join(' → ') + '），仍然取不到正文。');
        }
        out.push('原始响应前 240 字：' + String(raw || '').slice(0, 240));
        return out.join('\n');
    }

    /** 解析一次响应；解析不出正文时【不抛错】，把证据一起返回，交给调用方决定 */
    function parseAIReply(res) {
        if (res.status < 200 || res.status >= 300) {
            throw new Error('HTTP ' + res.status + ' ' + res.responseText.slice(0, 160));
        }
        let d;
        try {
            d = JSON.parse(res.responseText);
        } catch (e) {
            /* 流式响应（SSE）或自有格式会落到这里 —— 也把原文带上，别只报「解析失败」 */
            throw new Error('响应不是合法 JSON（HTTP ' + res.status +
                '）。若你填的是「流式」端点，请换成普通端点。原始响应前 240 字：' +
                res.responseText.slice(0, 240));
        }
        const choice = (d && d.choices && d.choices[0]) || null;
        const msg = (choice && choice.message) || {};
        const txt = msg.content || (choice && choice.text) ||
            (d && d.output && d.output.text) || '';
        return {
            txt: String(txt).trim(),
            finishReason: (choice && choice.finish_reason) || '',
            /* 【v2.5.10】调用方要靠它判断「是不是思考吃掉了额度」——
             *   这种情况加大额度是有救的，不该只报错。 */
            hasReasoning: !!(msg.reasoning_content || msg.reasoning),
            data: d,
            raw: res.responseText,
        };
    }

    /** 一句话说清「为什么正文是空的」（重试日志要用） */
    function describeEmptyCause(r) {
        if (r.finishReason === 'length') return 'finish_reason=length（额度在思考阶段就用完了）';
        if (r.hasReasoning) return '模型给了 reasoning_content（思考内容）却没给正文';
        return 'finish_reason=' + (r.finishReason || '（空）');
    }

    /** 加大额度【有可能】救回来的情形 —— 只有这两种值得再花一次请求：
     *   ① finish_reason=length          ：额度在「思考」阶段就耗尽了
     *   ② 有 reasoning_content 但正文空  ：思考完了、额度没了写正文
     *  其余（content_filter / 格式不对 / 401）加大额度毫无意义 —— 重试只是白花钱。 */
    function worthBiggerBudget(r) {
        return r.finishReason === 'length' || r.hasReasoning;
    }

    async function callAI(userContent, extraSystem) {
        const url = cfg('apiUrl');
        const key = cfg('apiKey');
        if (!url || !key) throw new Error('尚未配置 API 地址或 Key');

        const send = (maxTokens) => gmRequest({
            url,
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + key,
            },
            data: JSON.stringify({
                model: cfg('model'),
                messages: [
                    /* 【v2.5.6】extraSystem 用来按题目语言追加「语言要求」——
                     * 基础提示词是中文写的，不追加的话英文题会被答成中文。 */
                    { role: 'system', content: cfg('systemPrompt') + (extraSystem || '') },
                    { role: 'user', content: userContent },
                ],
                temperature: 0.9,
                max_tokens: maxTokens,
                /* 【v2.5.18】关掉「思考模式」—— 每次请求都带，不只是重试时带。
                 *   若只在重试时带：第一次请求仍会把额度烧在思考上、还要多等一轮，
                 *   而这一次请求很可能本来就是唯一成功的机会（额度紧张时）。 */
                ...(cfg('disableThinking') ? THINKING_DISABLED_BODY : {}),
            }),
            timeout: 30000,
        });

        /* 【v2.5.10 自愈】沿额度阶梯逐级试，拿到正文就停。
         * 实测反馈就是卡在这里：推理模型把额度全用在思考上，content 为空。
         * 自动放大能直接过去，用户不必先去搞明白「推理模型」是什么。 */
        let r = null;
        const tried = [];
        for (let i = 0; i < AI_MAX_TOKENS_LADDER.length; i++) {
            r = parseAIReply(await send(AI_MAX_TOKENS_LADDER[i]));
            tried.push(AI_MAX_TOKENS_LADDER[i]);
            if (r.txt) break;
            /* 不划算就别再试 —— 见 worthBiggerBudget 的注释。 */
            if (!worthBiggerBudget(r)) break;
            if (i < AI_MAX_TOKENS_LADDER.length - 1) {
                console.warn('[高校邦助手] 正文为空，' + describeEmptyCause(r) +
                    ' → 放大 max_tokens 到 ' + AI_MAX_TOKENS_LADDER[i + 1] +
                    ' 重试…（第 ' + (i + 1) + ' 次放大）');
            }
        }

        if (!r.txt) throw new Error(explainEmptyReply(r.data, r.raw, tried));
        return r.txt;
    }

    /* ============================================================
     *  四、页面类型
     * ============================================================ */

    // 【v2.4.0】播放器识别扩展到音频/其他容器。
    // 原来只认 #video_player_html5_api，导致「音频章节」「别的播放器 id」
    // 全部掉进 doc/unknown，跳章行为不可靠（用户指出这个缺口）。
    const VIDEO_SELECTORS = [
        '#video_player_html5_api',
        'video#video_player_html5_api',
        '.player-video video',
        'video[src]', 'video source',
    ];
    const AUDIO_SELECTORS = [
        '#audio_player_html5_api',
        '.player-audio audio',
        'audio[src]', 'audio source',
    ];

    // 找页面上的媒体元素（video 优先，其次 audio）
    function findMedia() {
        for (const sel of VIDEO_SELECTORS) {
            const el = q(sel);
            if (!el) continue;
            // 命中 <source> 时取它的父 <video>/<audio>
            const m = el.tagName === 'SOURCE' ? el.parentElement : el;
            if (m && (m.tagName === 'VIDEO' || m.tagName === 'AUDIO')) return m;
        }
        for (const sel of AUDIO_SELECTORS) {
            const el = q(sel);
            if (!el) continue;
            const m = el.tagName === 'SOURCE' ? el.parentElement : el;
            if (m && (m.tagName === 'VIDEO' || m.tagName === 'AUDIO')) return m;
        }
        return null;
    }

    // 视频：保持原语义（有播放器容器）
    const hasVideo = () => {
        const m = findMedia();
        if (m) return true;
        // 兜底：老选择器（有些页面播放器还没注入源，但容器已在）
        return !!q('#video_player_html5_api') || !!q('.player-video video');
    };

    // 【v2.4.0】音频章节（用户明确要求覆盖）
    const hasAudio = () => {
        const m = findMedia();
        return !!m && m.tagName === 'AUDIO';
    };

    const isTopicPage = () => !!q('.topic-reply-container') && !q('.player-video');

    // 非视频型章节：课件 / 作业 / 测验 / 讨论 / 音频。
    /* 【v2.5.0 新增】页面类型的中文名，用于日志与提示文案 */
    const KIND_CN = {
        video: '视频', audio: '音频', doc: '文档',
        quiz: '测验/考试', topic: '讨论', unknown: '未知类型',
    };

    const PAGE_KIND = {
        video: 'video',
        audio: 'audio',      // 【v2.4.0】音频（新增）
        topic: 'topic',      // 讨论（已有 AI 回复流程）
        quiz: 'quiz',        // 测验 / 作业（有题目）
        doc: 'doc',          // 纯课件 / 阅读材料
        unknown: 'unknown',
    };

    // 判断「这个页面有题目」——不看死类名，多信号任一成立。
    // 与 SEL 表同源的宽口径，避免站点改类名后整条答题链路失灵。
    function hasQuizContent() {
        for (const sel of [
            '.gxb-video-quiz-body', '.quiz-item', '.question-item', '.quiz-content',
            '.homework-content', '.examination-item',
            '[class*="quiz-body"]', '[class*="question-item"]', '[class*="ques-item"]',
            '[answer_id]', '[data-answer-id]',
        ]) {
            if (q(sel)) return true;
        }
        return false;
    }

    /* 【v2.5.0 新增】从【右侧目录】读当前章节的真实类型。
     *
     * 为什么需要它：
     *   真实页面里，主内容区不一定带可识别的题目类名（作业页可能只是个
     *   加载占位/iframe），但目录条目上永远带着 content_type 属性，实测
     *   82 条 = Video 25 / Courseware 17 / Quiz 18 / Topic 16 / Assignment 6，
     *   与图标类（video-status-ico / ware-status-ico / quiz-status-ico /
     *   topic-status-ico / assignment-status-ico）一一对应。
     *
     *   上一版只靠主内容区判类型，导致「当前章是作业」在目录快照里被
     *   误判成 doc → 走时间窗等待 → 用户看到的还是「作业页不跳」。
     *   这里用目录的 content_type 兜底，是最权威的来源。
     *
     * 返回 PAGE_KIND 之一，认不出返回 null。
     */
    function kindFromCatalog() {
        // 当前章 = 带 curFilmPlay 的那个目录条目（⬅ 该游标会随章节转移，实测已验证）
        const cur = document.querySelector('a.chapter-info.curFilmPlay') ||
            document.querySelector('a.chapter-info.gxb-cur-point.curFilmPlay');
        if (!cur) return null;
        const t = (cur.getAttribute('content_type') || '').trim().toLowerCase();
        if (!t) return null;
        if (t === 'video') return PAGE_KIND.video;
        if (t === 'audio') return PAGE_KIND.audio;
        if (t === 'topic') return PAGE_KIND.topic;
        // 作业 / 测验 / 考试都归 quiz（都要靠答题链路处理）
        if (t === 'quiz' || t === 'assignment' || t === 'exam' || t === 'homework') {
            return PAGE_KIND.quiz;
        }
        // 课件 / 阅读材料
        if (t === 'courseware' || t === 'doc' || t === 'document' || t === 'text') {
            return PAGE_KIND.doc;
        }
        return null;
    }

    /* ============================================================
     *  【v2.5.15】pageScope() —— **本页该不该跑自动功能**
     *
     *  用户报（8 个 URL）：「课程公告 / 成绩分析 / 测验列表 / 作业 / 考试 /
     *  讨论区 / 错题本 / 拓展内容」这些页右下角也显示「⏸ 运行中」，
     *  要求「请区别好各个网页」。
     *
     *  真正该跑的两类（用户原话）：
     *    ① /class/<cid>/unit/<uid>/chapter/<chid>/   自动刷课
     *    ② /class/<cid>/quiz/<数字>/                 自动答题
     *
     *  ── 判定手段为什么只认 URL（实机取证）──────────────────────
     *    browser-demo/_pages/ 抓下这 8 页 + 2 个对照页的真机 DOM，
     *    用本脚本真源码的 detectPageKind() 跑（test-v2515.mjs）：
     *      公告/成绩分析/考试/讨论区/拓展内容 → unknown
     *      测验列表(/quiz)/作业列表(/assignment)/错题本(/wrong) → **quiz**
     *    ⚠️ 错题本有 .question-item×5 + .answer-wap×5，与整卷测验页**高度相似**；
     *      作业列表 .quiz-item×6、测验列表 .quiz-item×18。
     *      ⇒ 光看 DOM 分不开「列表页」与「答题页」，**只能认 URL**。
     *    ⚠️ 目录页的章节链接是 href="javascript:void(0)"（真机原文），
     *      没有 /chapter/ 路径 ⇒ 更不能靠 DOM 反推「这是不是学习页」。
     *
     *  ── 判据 43（失败方向）：白名单 + 默认放行 ──────────────────
     *    ⚠️ 只拦「**明确认出**的已知非学习页」，认不出 ⇒ run=true（照旧跑）。
     *      反面写法（「不是学习页就拦」）会让站点一改 URL 就
     *      **全站静默空转**（不可发现，最坏）；本实现最坏只是
     *      **退回旧行为**（按钮照常显示运行中，用户看得见、报得出来）。
     *
     *  返回 { run, why, hint }：
     *    run=true  → 该页可以跑自动功能
     *    run=false → 该页不跑（why 说明原因，hint 是要写到按钮上的话）
     * ============================================================ */
    function pageScope() {
        const path = location.pathname;

        /* ---- A) 整卷测验页：**该跑**（用户明确要求）
         * ⚠️ 必须放在「/quiz 列表页」之前判，用 \d+ 精确区分：
         *      /class/12345/quiz        → 列表页（18 套题目的清单）
         *      /class/12345/quiz/100003 → 整卷页（该跑）
         * ------------------------------------------------------ */
        if (/\/quiz\/\d+/.test(path)) {
            return { run: true, why: '整卷测验页（自动答题）', hint: null };
        }

        /* ---- B) 章节页：**该跑**（用户明确要求）
         *   真机形态：/class/12345/unit/768543/chapter/5598990
         * ⚠️ 但**不能**因为「不是章节页」就拦（那正是判据 43 反对的）——
         *    所以这里只是「认出是章节页 ⇒ 明确放行」，不放行的事交给下面 C。
         * ------------------------------------------------------ */
        if (/\/unit\/[^/]+\/chapter\/[^/]+/.test(path)) {
            return { run: true, why: '章节页（自动刷课）', hint: null };
        }

        /* ---- C) 已知的非学习页：**不跑** ---------------------------------
         * 依据：用户逐条点名 + 实机勘察确认它们都不是章节页/答题页。
         * 前缀统一是 /class/<cid>/<feature>，所以按「路径尾段」匹配。
         * ⚠️ 用 $ 锚定到尾段，避免 /wrong 匹配到 /wrongXXX 这种假想路径。
         * ---------------------------------------------------------------- */
        const NOT_STUDY = [
            ['/announcement', '课程公告'],
            ['/scoreAnalysis', '成绩分析'],
            ['/quiz', '测验列表（清单页，点进去那套才自动答）'],
            ['/assignment', '作业列表（清单页）'],
            ['/exam', '考试列表'],
            ['/topic', '讨论区列表（章节内的讨论页会自动回复）'],
            ['/wrong', '错题本'],
            ['/activity', '拓展内容'],
        ];
        for (const [seg, label] of NOT_STUDY) {
            if (new RegExp(seg.replace(/\//g, '\\/') + '\\/?$').test(path)) {
                return { run: false, why: label, hint: '本页不适用 · ' + label };
            }
        }

        /* ---- D) 目录页：**不跑**（v2.5.11 的既有守卫，保持原样）----------
         * 这里【不】并到 C 里，因为它有自己的文案与播报（「目录页 · 不自动跳章」），
         * 而且现有测试与文档都对着那句文案。保持一致，不制造第二个真相。
         * ----------------------------------------------------------------- */
        if (isCatalogUrl()) {
            return { run: false, why: '课程目录', hint: '目录页 · 不自动跳章' };
        }
        /* ---- E) 认不出 ⇒ **默认放行**（判据 43）--------------------------
         * 失败方向：漏拦 = 退回旧行为（可见）；全停 = 静默空转（不可发现）。
         * 站点改 URL 形态时，这里保证脚本仍然照常工作。
         * ----------------------------------------------------------------- */
        return { run: true, why: '未识别的页面形态 → 按旧行为放行', hint: null };
    }

    /* 页面作用域的一次性播报（每页只吭一次，避免主循环每秒刷屏）*/
    let scopeHinted = '';

    /* ▼▼ 以下是 v2.5.11 原文（注释首行原样保留，续行才接得上）▼▼ */
    /* 【v2.5.11】本页是不是【课程目录页】。
     *
     * 判据：URL 以 /unit 结尾。
     *   实测形态（来自留档日志）：
     *     目录页  /class/12345/unit        ← 用户报「被自动跳章」的就是它
     *     章节页  /class/12345/unit/768543/chapter/5598990
     *
     * ⚠️⚠️ 这里【故意】写成「认得出目录页才拦」，而不是「不是章节页就拦」。
     *    两种写法的差别不是风格，是**失败方向**：
     *      · 「不是章节页就拦」：站点一旦改 URL 形态（加前缀 / 换路由 / 走 hash），
     *        条件就永远成立 ⇒ **整个脚本静默空转，什么都不跳了**。
     *        实测代价：本仓库 8 个测试套件全红（那些夹具的 URL 是 about:blank，
     *        代表的正是「URL 不是章节页、但页面确实是章节」这种情形）。
     *      · 「认得出目录页才拦」（本实现）：站点改 URL 时只是**退回旧行为**
     *        （目录页又会被跳），用户看得见、报得出来。
     *    ⇒ 判据要选**失败方向安全**的那一侧：宁可漏拦（可发现），
     *      不可全停（不可发现）。
     *
     * ⚠️ 为什么不用 DOM 判（比如「有没有 #chapterUnit」）：
     *    目录容器在【章节页的侧边栏里也有】—— 光看「容器存在」会把章节页也拦掉，
     *    那样整门课就再也不跳了。
     *
     * ⚠️ 只认 pathname，不认 hash：
     *    实测切章时 hash 会先变、pathname 后变（见 v2.5.3 的取证日志），
     *    只认 pathname 就不会在切换途中误判。 */
    function isCatalogUrl() {
        return /\/unit\/?$/.test(location.pathname);
    }

    function detectPageKind() {
        if (isTopicPage()) return PAGE_KIND.topic;
        // 【v2.4.0】音频优先于视频判定：先看有没有 <audio>
        if (hasAudio()) return PAGE_KIND.audio;
        if (hasVideo()) return PAGE_KIND.video;
        // 无播放器但页面里有题目 → 测验/作业页
        if (hasQuizContent()) return PAGE_KIND.quiz;
        // 【v2.5.0】主内容区没有可识别信号时，从右侧目录的 content_type 读真实类型。
        //   这解决了「作业页主内容区只有 iframe/占位、被判成 doc 而死等宽限期」。
        const byCatalog = kindFromCatalog();
        if (byCatalog) return byCatalog;
        // 有目录容器 / 章节条目 → 确实在课程页里，只是这一章是纯文档
        if (q('#chapterUnit, .chapter-unit-container, i.student-chapter-status, a.chapter-info')) {
            return PAGE_KIND.doc;
        }
        return PAGE_KIND.unknown;
    }

    /* ============================================================
     *  五、讨论区：AI 自动回复
     * ============================================================ */

    // idle=本页还没试过 | working=正在处理 | done=已提交 | failed=试过且失败，停下等用户
    // 【v2.4.0】新增 failed：AI 失败后不能退回 idle，否则主循环每秒都会当成
    // 「还没试过」再调一次 API —— 既刷爆配额，又让「停下+弹提示」永远不触发。
    let topicState = 'idle';

    /* 【v2.5.7】题目块里【不是正文】的部分，取文本时要剔掉。
     *
     * 真实页面里这些块混在题目容器内，且**全是中文**：
     *   老师 林扬欢 2026-09-15 10:15 / 精 / 在…前参与本讨论 / 得分讨论的规则 / 举报
     * 它们会污染「题目语言判定」—— 短英文题因此被判成中文题，
     * 结果就是**英语课的讨论题被答成中文**（用户实测报的就是这个）。
     *
     * 为什么标题（.topic-subject）也列进来：
     *   ① 拿到的正文才是学生要回答的那个问题；标题只是标签。
     *   ② 更关键：不列它的话，「嵌套结构」取到正文、「退化结构」取到「标题+正文」——
     *      同一种页面结构变化会改变喂给模型的文本，两条路径产出不一致。
     *   ③ 正文取不到时不会丢信息：选择器循环会继续往下走到 .topic-subject 兜底。 */
    const TOPIC_META_SEL = '.topic-author, .topic-subject, .remind-container, ' +
        '.topic-report, .has-more-info, .teach-essence';

    /* 【v2.5.7】按文本节点递归取文本，跳过元信息块。
     * 不用 innerText 是因为它没法只剔一部分子元素；
     * 也不用克隆节点——克隆后 innerText 退化成 textContent，
     * 块级元素之间会丢掉分隔，单词会粘在一起。 */
    function textWithoutMeta(el) {
        const parts = [];
        const walk = (node) => {
            for (const n of node.childNodes) {
                if (n.nodeType === 3) {
                    const t = n.textContent.trim();
                    if (t) parts.push(t);
                } else if (n.nodeType === 1 && !n.matches(TOPIC_META_SEL)) {
                    walk(n);
                }
            }
        };
        walk(el);
        return parts.join(' ').trim();
    }

    function getTopicText() {
        for (const sel of [
            // 用户真实 DOM：<h2 class="topic-subject"> 标题 + <div class="topic-content"><p><span> 正文
            '.topic-detail', '.topic-content', '.topic-subject', '.topic-title',
            '.discuss-detail', '.topic-question', '.course-topic',
        ]) {
            /* 【v2.5.7】同名类会【嵌套自己】：真实页面是
             *   div.topic-content.fl_left > div.topic-content   ← 正文
             * 外层是容器，里面混着中文界面文字（老师/日期/截止时间/举报）。
             * querySelector 取到外层 → 短英文题的中文占比超过阈值 → 判成中文题。
             * ⇒ 取【最内层】那个（没有同名后代的），它才是正文。 */
            const all = qa(sel);
            const el = all.find((e) => !e.querySelector(sel)) || all[0];
            if (!el) continue;
            // 兜底：取到的还带元信息块（站点不再嵌套时会发生）→ 剔掉再取
            const text = el.querySelector(TOPIC_META_SEL)
                ? textWithoutMeta(el)
                : el.innerText.trim();
            if (text) return text.slice(0, 1000);
        }
        const lines = (document.body.innerText || '')
            .split('\n').map((s) => s.trim()).filter((s) => s.length > 15);
        return lines.slice(0, 8).join('\n').slice(0, 1000) || '课程讨论';
    }

    // 已回复时会显示「编辑」或「更新回复」按钮
    function alreadyReplied() {
        return shown('.post-submit-edit') || shown('.post-submit-update');
    }

    // 记录失败原因，供提示条显示（区分「没配 Key」和「调用出错」）
    let topicFailedReason = '';
    /* 【v2.5.5】本页讨论的最终处置，供 isChapterSettled 的 reason 用。
     * ⚠️ 别笼统地说「讨论已提交」—— 跳过和抄不到都【没有提交】。
     *    日志说错，排查的人就会以为脚本干了它没干的事。 */
    let topicDoneReason = '讨论已提交';
    // 暂时性失败（编辑器未就绪/按钮不可见）的最大重试次数
    const TOPIC_MAX_RETRY = 5;
    let topicRetry = 0;
    // 失败诊断只打一次，避免控制台每秒被同一句话刷满
    let topicHintLogged = false;

    /* ============================================================
     *  【v2.5.5】「抄答案」：从讨论区已有回复里挑一条
     *
     *  真实 DOM（2026-09-19 在真机抓的，章节 5598950）：
     *    div.topic-replies
     *      └ div#replies
     *          └ div.reply-container.clear-fix          ← 一条回复
     *              ├ div.gxb-avatar.fl_left
     *              └ div.reply-detail-container.fl_left
     *                  └ div.reply-content-container
     *                      ├ div.topic-author.clear-fix
     *                      │    ├ <b>某同学</b>            ← ✅ 作者名在这
     *                      │    └ <span>12小时前回复</span>
     *                      │    └ span.topic-teacher      ← ⚠️ 这是【老师给这条回复的批注】
     *                      │                                  （如「讨论截止后公布成绩」），不是作者身份
     *                      └ div.reply-content            ← ✅ 正文
     *
     *  ⚠️ 先拿真实 DOM 再写选择器 —— 本项目的老教训是反着来必返工。
     * ============================================================ */

    /** 收集页面上所有「有正文」的已有回复 */
    function collectCopyableReplies() {
        const out = [];
        for (const el of document.querySelectorAll('#replies .reply-content')) {
            /* 【v2.5.5 防御】评论区的文本也不能抄。
             *   每条回复下面都带一个「评论」区（.all-comments-container），
             *   它同样落在 #replies 里面。
             *   实测（真机 DOM 2026-09-19，章节 5598950）：评论用的是另一套 class
             *   （.gxb-comment / .my-comment / .comment-textarea），没有 .reply-content，
             *   所以当前不会撞 —— 这条是【防御】，不是已证实的 bug。
             *   但一旦平台把评论也改成 .reply-content，就会「抄一条评论当讨论答案」提交，
             *   而平台的回复【提交后不可删除】→ 不可逆。
             *   为什么不写死成四层嵌套选择器：那样平台多包一层就静默失效
             *   （抄不到 → 每次都跳过），比「明确排除一个已知区域」更脆。 */
            if (el.closest('.all-comments-container')) continue;
            const txt = (el.innerText || '').trim();
            if (!txt) continue;
            const box = el.closest('.reply-container');
            /* 作者名优先取 .topic-author 里的 <b>；取不到再退回整段文本并剥掉「xx前回复」 */
            let author = '';
            const b = box && box.querySelector('.topic-author b');
            if (b && (b.innerText || '').trim()) {
                author = (b.innerText || '').trim();
            } else {
                const a = box && box.querySelector('.topic-author');
                author = a ? (a.innerText || '').replace(/\s+/g, ' ').trim() : '';
                const note = box && box.querySelector('.topic-teacher');
                if (note) author = author.replace((note.innerText || '').trim(), '').trim();
                author = author.replace(/\d+\s*(秒|分钟|小时|天|月|年)前回复\s*$/, '').trim();
            }
            out.push({ text: txt, author: author || '(未知作者)', len: txt.length });
        }
        return out;
    }

    /** 挑一条来抄。挑不到返回 { ok:false, reason }，调用方负责「跳过 + 报错」。 */
    function pickReplyToCopy() {
        const all = collectCopyableReplies();
        if (!all.length) {
            return { ok: false, total: 0, reason: '这一页还没有任何人回复' };
        }
        /* 30 字以下的不要：多半是「同意楼上」这类敷衍，抄了等于没答 */
        const usable = all.filter((r) => r.len >= 30);
        const pool = (usable.length ? usable : all).slice().sort((a, b) => b.len - a.len);

        /* 从最长的 3 条里随机挑一条：
         *   · 不固定取第一条 —— 一门课十几个讨论都抄同一个人，老师一眼看出
         *   · 不固定取最长 —— 可能是一篇超长小作文，贴进去突兀 */
        const top = pool.slice(0, 3);
        const picked = top[Math.floor(Math.random() * top.length)];
        return { ok: true, picked, total: all.length, candidates: pool.length };
    }

    async function handleTopicPage() {
        if (topicState !== 'idle') return;
        const mode = cfg('topicMode');

        /* ---- 【v2.5.5】「跳过」模式 ----
         * ⚠️ 这里必须【主动跳章】，不能只是 return。
         *    讨论章在 isSkipInstantlyKind() 里是【不跳】的（原注释：「讨论要回复」），
         *    所以只 return 的话脚本会在每个讨论章干等着不动 ——
         *    一门课十几个讨论章，等于整个刷课流程卡死在这里。
         *    用户要的「跳过」= 这题我不答，你继续走。 */
        if (mode === 'skip') {
            /* ⚠️ 先看这一页是不是【已经回复过】—— 真实页面实测（2026-09-19，6 个讨论章）：
             *     未回复 → .post-submit 可见、编辑器空、已有回复 0 条
             *     已回复 → .post-submit 隐藏、.post-submit-edit 可见、
             *              编辑器被平台预填成【你自己的回复】
             *   在已回复的页面上说「未提交任何内容」是错的（你提交过），
             *   会让排查的人以为脚本漏做了。所以分开说。 */
            const repliedHere = alreadyReplied();
            topicState = 'done';
            topicDoneReason = repliedHere ? '讨论此前已回复过' : '讨论按设置跳过（未提交）';
            console.warn('[高校邦助手] 本页讨论' + (repliedHere
              ? '此前已回复过，脚本不做任何改动。'
              : '按设置【跳过】：不提交任何内容。（面板「设置」 可改成「抄答案」或「接入 API」）'));
            showTopicNote(repliedHere
              ? '本页讨论你之前已经回复过了，脚本不做任何改动。'
              : '本页讨论按设置【跳过】，未提交任何内容。' +
                '想自动处理，可在面板「设置」 改成「抄答案」或「接入 API」。');
            if (cfg('autoNext')) { await sleep(1200); goNext(); }
            return;
        }
        // 没配接口：直接判 failed，不用等一次必然失败的请求（也让提示条立刻有据可依）
        if (mode === 'api' && (!cfg('apiUrl') || !cfg('apiKey'))) {
            topicFailedReason = '尚未配置 AI 接口';
            topicState = 'failed';
            return;
        }

        topicState = 'working';
        try {
            // 先等编辑器就绪（UEditor 是异步初始化的）
            for (let i = 0; i < 10 && !getEditorBody(); i++) await sleep(300);

            if (alreadyReplied()) {
                log('讨论已回复过，跳过');
                topicState = 'done';
                return;
            }

            let answer;
            try {
                if (mode === 'copy') {
                    /* ---- 「抄答案」：抄一条已有回复 ----
                     * 抄不到 → 按用户要求「跳过并报错」：不提交、页面说明、继续跳下一章。 */
                    const pick = pickReplyToCopy();
                    if (!pick.ok) {
                        console.warn('[高校邦助手] 抄答案失败：' + pick.reason +
                            '（页面上共 ' + pick.total + ' 条回复）。按设置不提交任何内容，直接跳过本章。');
                        topicState = 'done';
                        topicDoneReason = '抄不到可抄的回复，已跳过（未提交）';
                        showTopicNote('本页讨论【抄不到可抄的回复】（' + pick.reason + '），' +
                            '已按设置不提交任何内容，直接跳过本章。想改成 AI 生成可在面板「设置」 换模式。');
                        if (cfg('autoNext')) { await sleep(1200); goNext(); }
                        return;
                    }
                    answer = pick.picked.text;
                    console.log('[高校邦助手] 抄到一条回复：作者=' + pick.picked.author +
                        '，' + pick.picked.len + ' 字（候选 ' + pick.candidates + ' 条 / 页面共 ' + pick.total + ' 条）');
                } else {
                    const topic = getTopicText();
                    log('讨论话题:', topic);

                    /* 【v2.5.6】按题目语言追加要求，并在生成后校验。
                     * 用户实测：接 DeepSeek 后英文讨论题被答成了中文。 */
                    const lang = detectLang(topic);
                    log('题目语言判定:', lang + '（' + LANG_CN[lang] + '）');
                    answer = await callAI('讨论话题：' + topic, langClause(lang));

                    if (langMismatch(lang, answer)) {
                        console.warn('[高校邦助手] 回复语言与题目不一致（题目=' + LANG_CN[lang] +
                            '），带更强指令重试一次…');
                        const retry = await callAI('讨论话题：' + topic,
                            langClause(lang) + '\n\n⚠️ 上一次的回复语言不对。这次务必严格遵守上面的语言要求。');
                        if (langMismatch(lang, retry)) {
                            /* 宁可这一章不提交，也不发一条语言不对的回复 ——
                             * 平台的回复【提交后不可删除】，发出去就收不回。 */
                            console.error('[高校邦助手] 重试后语言仍不一致，已停止提交（不会发出语言不对的回复）。');
                            topicFailedReason = 'AI 回复语言与题目不一致（题目是' + LANG_CN[lang] +
                                '），重试一次仍不对';
                            topicState = 'failed';
                            return;
                        }
                        answer = retry;
                        console.log('[高校邦助手] 重试后语言正确，采用重试结果。');
                    }
                }
            } catch (err) {
                // 【v2.2.1】不再自动提交兜底文案，停下来等用户处理。
                // 宁可这一章不提交，也不能替用户发一句与题目无关、且删不掉的回复。
                console.error('[高校邦助手] AI 生成失败，已停止提交（不会使用任何兜底答案）：' + err.message);
                console.warn('[高校邦助手] 请检查 API 配置（面板「设置」），或关掉「AI 自动回复讨论」让它跳过讨论页。');
                // 【v2.4.0】置 'failed' 而非 'idle'：本页到此为止，不再自动重试。
                // 想重试请刷新页面（刷新会重新开始，配置改了也能生效）。
                topicFailedReason = err.message || '未知错误';
                topicState = 'failed';
                return;
            }
            log('生成回复:', answer);

            // 【v2.4.0】下面两条是「DOM 还没长出来」的暂时性失败，重试是合理的，
            // 但必须封顶 —— 原实现无条件退回 'idle' 且无计数，DOM 一直不出来
            // 就会每秒重试到天荒地老，日志被刷满、后面真正的原因反而看不见。
            if (!setEditorText(answer)) {
                if (++topicRetry >= TOPIC_MAX_RETRY) {
                    topicFailedReason = '编辑器一直未就绪';
                    topicState = 'failed';
                    console.warn('[高校邦助手] 编辑器重试 ' + topicRetry + ' 次仍未就绪，停止重试。' +
                        '若该页确实没有回复框，可在菜单里关掉「AI 自动回复讨论」。');
                    return;
                }
                console.warn('[高校邦助手] 编辑器未就绪，稍后重试（' + topicRetry + '/' + TOPIC_MAX_RETRY + '）');
                topicState = 'idle';
                return;
            }

            await sleep(600);
            if (!submitReply()) {
                if (++topicRetry >= TOPIC_MAX_RETRY) {
                    topicFailedReason = '回复按钮一直不可见';
                    topicState = 'failed';
                    console.warn('[高校邦助手] 回复按钮重试 ' + topicRetry + ' 次仍不可见，停止重试。');
                    return;
                }
                console.warn('[高校邦助手] 回复按钮不可见，稍后重试（' + topicRetry + '/' + TOPIC_MAX_RETRY + '）');
                topicState = 'idle';
                return;
            }

            console.log('[高校邦助手] 讨论回复已提交');
            topicState = 'done';

            if (cfg('autoNext')) {
                await sleep(1800);
                goNext();
            }
        } catch (e) {
            console.error('[高校邦助手] 讨论页异常：', e);
            topicState = 'idle';
        }
    }

    /* ============================================================
     *  五点五、【v2.4.0 新增】右侧目录进度读取
     *
     *  【为什么这才是对的判据】
     *  右侧目录栏上每一章都有自己的状态图标/进度标记 —— 那是**平台自己记录的学习进度**，
     *  比读播放器可靠得多：
     *    - 视频/音频：进度是平台按心跳记的，比 body 上的 currentTime 权威
     *    - 文档：没有播放器，但目录里照样有「已完成」标记 ← 这是唯一的判据
     *    - 测验：答完才会标记完成
     *  所以「能不能跳下一章」正解 = 「目录里这一章标记为已完成了没有」。
     *
     *  原实现（抄自修改版 v0.9）其实用的是同一份数据，但只把它当「找下一章」用，
     *  且过滤条件写得很窄（4 个假设全要成立），任一不成立就静默失效。
     *  这里改成：先认「已完成标记」，认不出再逐级降级。
     * ============================================================ */

    /* ------------------------------------------------------------
     * 【v2.4.1 按真实 DOM 重写】目录进度的读取
     *
     * 真实结构（用户提供，2026-09-18）：
     *   <div class="chapter-unit-container" id="chapterUnit">
     *     <div class="unit-list" data-unit-id="...">          ← 一个 Chapter
     *       <h4 class="gxb-cur-point lxy-list-css lxy-h4-fix" title="Chapter 4: Politics">
     *         <i class="student-unit-status gxb-icon-begin gxb-icon-ing"></i>   ← Chapter 级状态
     *       </h4>
     *       <div class="unit-list item-list-dis">             ← 一个小节
     *         <h4 class="gxb-cur-point lxy-click-view" title="...">
     *           <i class="student-item-status gxb-icon-begin"></i>              ← 小节级状态
     *         </h4>
     *         <ul class="gxb-show">
     *           <li class="lxy-chapter-li">                  ← ✅ 真正的「章节条目」
     *             <h5>
     *               <i class="video-status-ico all-status-ico"></i>             ← 类型图标（不管）
     *               <i class="gxb-icon-begin student-chapter-status gxb-icon-end"></i>  ← ✅ 状态在这
     *               <a class="chapter-info gxb-cur-point lxy-set-color"
     *                  chapter_id="..." content_type="Video" title="...">      ← 跳转/信息锚点
     *           </li>
     *         </ul>
     *       </div>
     *     </div>
     *   </div>
     *
     * ⚠️ 两个必须避开的干扰项：
     *   1) <ul class="unit-list-nav"><li class="active">目录</li>   ← 导航 tab，别当当前章
     *   2) class 里含 gxb-cur-point 的元素有 23 个（h4/a 都有），不是唯一游标
     * ---------------------------------------------------------- */

    // 章节条目容器：真实站点用 li.lxy-chapter-li，其余是兜底
    const CHAPTER_ITEM_SELECTORS = [
        'li.lxy-chapter-li',              // ✅ 真实结构
        '#chapterUnit ul.gxb-show > li',  // 同义（限定在目录容器内，防误伤）
        'li[class*="chapter-li"]',
        'i.student-chapter-status',       // 兜底：由图标映射回父级
    ];

    // 章节级状态图标的语义（真实站点只有这三种）
    const STATUS_DONE = 'gxb-icon-end';    // 已完成
    const STATUS_DOING = 'gxb-icon-ing';   // 进行中
    // ⚠️ gxb-icon-begin 是所有图标都带的基类，不能当「未完成」判据

    // 取所有章节条目
    function chapterItems() {
        for (const sel of CHAPTER_ITEM_SELECTORS) {
            const els = qa(sel);
            if (!els.length) continue;
            // 命中状态图标 → 映射回它所在的 li
            return els
                .map((e) => (/student-chapter-status/.test(e.className || '')
                    ? (e.closest('li') || e.parentElement)
                    : e))
                .filter(Boolean);
        }
        return [];
    }

    // 取条目内【章节级】状态图标的 class 字符串
    //   ⚠️ 必须精确到 i.student-chapter-status，不能用「子孙里有没有 icon-end」——
    //      祖先链上的 student-unit-status / student-item-status 也带 icon-end，
    //      会把「Chapter 已完成」误当成「这个小节已完成」（v2.4.0 实测的错）。
    function chapterStatusIcon(item) {
        if (!item) return null;
        // 优先条目自己的（li 内的 h5 里）
        const own = item.querySelector('i.student-chapter-status');
        if (own) return own;
        // 兜底：条目本身就是 status 图标
        if (/student-chapter-status/.test(item.className || '')) return item;
        return null;
    }

    // 判断单个章节条目是否「已完成」——只看【章节级】图标
    function isItemDone(item) {
        const icon = chapterStatusIcon(item);
        if (!icon) return false;
        const cls = String(icon.className || '');
        // ✅ 唯一判据：章节级图标带 gxb-icon-end
        if (cls.includes(STATUS_DONE)) return true;
        // 文本兜底（站点若改用文字标注）
        const t = (item.innerText || '').replace(/\s/g, '');
        if (/已完成|已学完|已看完|已通过/.test(t)) return true;
        return false;
    }

    // 这一章是否「进行中」（看过但没完成）
    function isItemDoing(item) {
        const icon = chapterStatusIcon(item);
        if (!icon) return false;
        return String(icon.className || '').includes(STATUS_DOING);
    }

    /* 【v2.5.1 新增】这一章是否【锁住 / 未解锁】—— 点不进去的那种。
     *
     * 为什么需要它：
     *   判断「后面还有没有章节可刷」时，必须区分两种情况：
     *     · 折叠（display:none）—— 只是 UI 收起来了，内容还在，能点
     *     · 锁住（islock="true" / isunlock="false"）—— 真的点不进去
     *   只有后者才该算「刷不到了」。
     *
     * 真实 DOM 的凭证（都在 a.chapter-info 上）：
     *   <a class="chapter-info" chapter_id="5598946" content_type="Assignment"
     *      islock="false" isunlock="true">
     * 另外锁住的条目通常带 lock 相关类名或锁图标。
     * ============================================================ */
    function isItemLocked(item) {
        if (!item) return false;
        const a = item.querySelector('a.chapter-info') || item;
        // ① 明确属性（真实站点用这一对）
        const islock = String(a.getAttribute('islock') || '').toLowerCase();
        const isunlock = String(a.getAttribute('isunlock') || '').toLowerCase();
        if (islock === 'true') return true;
        if (isunlock === 'false') return true;
        // ② class 里带 lock（lock / islock / locked / chapter-lock …）
        const cls = String(item.className || '') + ' ' + String(a.className || '');
        if (/(^|[\s-])(is)?lock(ed)?([\s-]|$)/i.test(cls)) return true;
        // ③ 条目里有锁图标
        if (item.querySelector('i[class*="lock"], .lock-icon, .icon-lock')) return true;
        return false;
    }

    // 找「当前正在看的这一章」的目录条目
    //   真实站点唯一的当前标记是 a.chapter-info.curFilmPlay（实测全页恰好 1 个）
    function currentNodeItem() {
        // ① 首选：平台给当前播放项挂的 curFilmPlay
        for (const sel of [
            'a.chapter-info.curFilmPlay',
            'a.curFilmPlay',
            '#chapterUnit a[class*="curFilmPlay"]',
        ]) {
            const a = q(sel);
            if (a) {
                const li = a.closest('li');
                if (li) return li;
            }
        }
        // ② 次选：内联背景色标记（当前项被高亮）
        //    真实值：style="color: rgb(31,182,255); background: rgb(242,244,247);"
        const lit = qa('#chapterUnit a.chapter-info[style*="background"]')
            .find((a) => /background:\s*rgb/.test(a.getAttribute('style') || ''));
        if (lit) {
            const li = lit.closest('li');
            if (li) return li;
        }
        // ⚠️ 这里【故意不】用 .active / .gxb-cur-point 兜底：
        //    .active 命中的是导航 tab「目录」，.gxb-cur-point 全页 23 个。
        //    宁可返回 null 走时间窗降级，也不要拿错条目得出错误结论。
        return null;
    }

    // 对外接口：这一章在目录里标记为完成了吗？
    //   返回 true  = 明确已完成 → 可以跳
    //   返回 false = 明确未完成 → 不跳
    //   返回 null  = 读不到目录 / 认不出当前章 → 交给调用方降级
    function readChapterProgress() {
        const items = chapterItems();
        if (!items.length) return null;

        const cur = currentNodeItem();

        // 认不出「当前章」→ 返回 null，让调用方降级到时间窗兜底。
        // ⚠️ 绝不能退化成「目录里有没有任何一章是完成的」：
        //    已看完的历史章节当然带完成标记，那会让任何一页都被判成
        //    「本章已完成」→ 每章进来立刻跳走，整门课瞬间空转过去。
        //    必须精确定位到当前这一章。
        if (!cur) return null;

        return isItemDone(cur);   // true=已完成 / false=明确未完成
    }

    /* ============================================================
     *  六、章节跳转（v2.3.1 重做：多级兜底 + 失败诊断）
     *
     *  【为什么之前"无效"】原文只走一条路：扫描章节列表找未完成项。
     *  那条路抄自「修改版 v0.9」，依赖 4 个 class 假设同时成立，
     *  任一不成立就过滤出空数组 → 静默什么都不做（用户只看到"没反应"）。
     *
     *  而更早的「v0.5」用的是完全不同的机制：
     *      document.getElementsByClassName("chapter-next gxb-cur-point")[0]
     *  这是平台自己维护的"下一章"游标 —— 单个元素、语义明确、天然正确。
     *
     *  所以现在改成三级兜底，从最可靠往下找：
     *    ① chapter-next.gxb-cur-point   ← 平台游标（首选，旧脚本验证过）
     *    ② 任何 chapter-next 元素        ← 游标类名变了也能中
     *    ③ 扫描章节列表找未完成项        ← 最后兜底（原逻辑）
     *  三级全空 → 打印诊断清单，告诉你页面到底长什么样。
     * ============================================================ */

    // 记录"上次点跳章"的信息，用于确认是否真的跳走了
    let lastJump = null;

    function findNextChapter() {
        // ---- ① 平台维护的"下一章"游标（最可靠）----
        for (const sel of [
            'a.chapter-next.gxb-cur-point',
            '.chapter-next.gxb-cur-point',
            'a.chapter-next',
            '.chapter-next',
        ]) {
            const el = q(sel);
            if (el && visible(el)) return el;
        }

        // ---- ③ 目录顺序找「当前章的下一章」（真实 DOM 下最可靠）----
        //  真实结构里没有 chapter-next 元素，所以 ①② 通常都不中。
        //  最贴切的语义是：在目录的章节序列里，当前章的【下一个】。
        try {
            const items = chapterItems();
            if (items.length) {
                const cur = currentNodeItem();
                const curIdx = cur ? items.indexOf(cur) : -1;
                if (curIdx >= 0 && curIdx + 1 < items.length) {
                    const a = items[curIdx + 1].querySelector('a.chapter-info');
                    if (a && visible(a)) return a;
                }
                // 认不出当前章 → 退化为「第一个未完成的章节」
                for (const it of items) {
                    if (!isItemDone(it)) {
                        const a = it.querySelector('a.chapter-info');
                        if (a && visible(a)) return a;
                    }
                }
            }
        } catch (e) {
            /* 落到下面返回 null，由调用方打印诊断 */
        }

        // ---- ④ 老式：扫描 gxb-icon-begin 未完成项（前代站点结构）----
        const list = qa('i.gxb-icon-begin.student-chapter-status').filter((c) => {
            const p = c.parentElement;
            return (
                !c.className.includes('gxb-icon-end') &&
                !p.querySelector('.quiz-status-ico')
            );
        });
        if (list.length) {
            const el = list[0].parentElement?.querySelector('a.chapter-info');
            if (el && visible(el)) return el;
        }

        return null;
    }

    // 找不到下一章时，把「页面上所有像章节链接的东西」打出来，方便定位
    function dumpChapterCandidates() {
        const seen = new Set();
        const out = [];
        document.querySelectorAll('a, li, i, div, span').forEach((el) => {
            if (el.offsetParent === null) return;
            const cls = String(el.className || '');
            if (!/chapter|next|cur-point|icon-begin|icon-end/i.test(cls)) return;
            const t = (el.innerText || el.textContent || '').trim().slice(0, 20);
            const k = cls + '|' + t;
            if (seen.has(k)) return;
            seen.add(k);
            out.push('<' + el.tagName.toLowerCase() + ' class="' + cls + '">' + t);
        });
        return out.slice(0, 30);
    }

    function goNext() {
        const next = findNextChapter();
        if (!next) {
            console.warn(
                '[高校邦助手] 找不到「下一章」入口，无法跳转。请把下面这份清单发给开发者：\n' +
                (dumpChapterCandidates().join('\n') || '(页面上没有任何含 chapter/next 的元素)')
            );
            return false;
        }

        const href = next.getAttribute('href') || '';
        log('跳转下一章:', (next.innerText || '').trim().slice(0, 20), href);
        lastJump = { from: location.pathname, at: Date.now() };
        /* 【v2.5.4】登记「这次离开页面是我发起的」，供跨页面侦测排除自己。
         * 不登记的话，自己的每一次正常跳章都会被误报成「外部抢跳」。
         * 必须写在 click() 之前 —— click 会触发捕获监听器（标成 'user'），
         * 而 markLeave 里 'me' 优先级更高，不会被覆盖。 */
        markLeave('me');
        next.click();
        return true;
    }

    // 跳章是否生效：点了之后路径有没有变（或页面有没有在刷新）
    function jumpSeemsStuck() {
        if (!lastJump) return false;
        // 3 秒内路径没变 → 可能点了没反应
        return location.pathname === lastJump.from && Date.now() - lastJump.at > 3000;
    }

    /* ============================================================
     *  【v2.5.12】「整卷测验页」识别 —— 答题链路的【安全守卫】
     *
     *  背景（真机勘察结论，见 browser-demo/结论-测验页勘察-2026-09-21.md）：
     *    「视频弹题」与「测验页」是两种完全不同的页面，而本脚本原本只有一套逻辑：
     *
     *      视频弹题：一次只渲染【当前一题】+ 页面【有】.correctAnswer + 有「下一题」
     *      测验页  ：**整卷一次性全渲染** + **没有** .correctAnswer + **没有**「下一题」
     *                且 **#quizSubmit 一开始就在**
     *
     *    于是旧逻辑在测验页会把「当前可见那一题」当成第一题，
     *    找不到「下一题」就**直接点提交** ⇒ **把只答了 1 题的卷子交掉**。
     *
     *  ⚠️ 这个错误是【不可撤销】的：用户明确说「一个测验只有三次答题机会，
     *     只许成功不许失败」，而实测还有 3 套只有 **1 次**机会
     *     （100002 / 100004 / 100006）—— 错一次就是该章 0 分。
     *
     *  ⚠️ 判据方向（本项目判据 43「失败方向安全」）：
     *    写成「**认得出整卷测验页才拦**」，而不是「不是弹题就不答」。
     *    后者一旦站点改版会变成**整个答题功能静默失效**（用户以为脚本坏了）；
     *    前者只会**退回旧行为**（又去点测验页）—— 看得见、报得出来。
     *    与 v2.5.11 的 isCatalogUrl 是同一个判据。
     *
     *  识别用【组合特征】，不看单一类名（类名站点随时会改）：
     *    ① 题量 >= 2            —— 弹题一次只渲染一题（length 恒为 1），这是最本质的差别
     *    ② 存在常驻提交键        —— #quizSubmit（或语义等价的「提交」大按钮）
     *    两条【同时满足】才判为整卷测验页；另外 URL 特征命中时直接成立。
     * ============================================================ */
    function isWholePaperQuizPage() {
        /* ① URL 特征：真机形态 /class/<id>/quiz/<quizId>
         *    ⚠️ 只当【额外确认】，不是唯一判据 —— 测验也可能从别的入口进来。 */
        const byUrl = /\/quiz\/\d+/.test(location.pathname);

        /* ② 题量：整卷测验页会把所有题一次性渲染出来 */
        const qCount = document.querySelectorAll('.question-item, .examination-item').length;

        /* ③ 常驻提交键：测验页的「提交」一开始就在（弹题要到最后才出现） */
        const submitAlways =
            !!document.querySelector('#quizSubmit') ||
            !!document.querySelector('.quiz-option .gxb-btn-pri') ||
            !!document.querySelector('#quizPaper .gxb-btn-pri');

        /* 组合判据：URL 命中 或（多题 + 常驻提交键） */
        if (byUrl) return { whole: true, reason: 'URL 是 /quiz/<id>', qCount, submitAlways };
        if (qCount >= 2 && submitAlways) {
            return { whole: true, reason: '整卷已渲染（' + qCount + ' 题）+ 提交键常驻', qCount, submitAlways };
        }
        return { whole: false, reason: '题量 ' + qCount + '，提交键常驻=' + submitAlways, qCount, submitAlways };
    }

    /* 整卷测验页只播报一次（主循环每秒跑一轮，不拦着会刷屏） */
    let wholePaperHinted = false;

    /* 守卫命中时的播报。
     * ⚠️ 用 console.warn 而非 log()：这条是「脚本为什么不动」的答案，
     *    不能被 debug 开关连坐（本项目反复踩过这个坑，见判据 24）。 */
    function warnWholePaperQuizPage(info) {
        if (wholePaperHinted) return;
        wholePaperHinted = true;
        console.warn(
            '[高校邦助手] 本页是【整卷测验】（' + info.reason + '）—— 按设计【不自动作答】。\n' +
            '  ⚠️ 这是保护，不是故障：测验通常只有 1~3 次机会，\n' +
            '     自动乱答 / 只答一题就交卷会【直接烧掉机会】，且不可撤销。\n' +
            '  ✅ 现在请你手动作答并提交（本脚本不会碰它）。\n' +
            '  ℹ️ 视频里的随堂弹题仍然会自动作答，不受影响。'
        );
        /* 【v2.5.12b】priority=1：这是一次性的「为什么不动」说明，
         *   不能被每秒刷新的「运行中 N/M」盖掉。 */
        updatePauseButtonHint('测验页 · 不自动作答', 1);
    }

    /* ============================================================
     *  七、自动答题（MutationObserver，来自脚本 2）
     * ============================================================ */

    let quizObserver = null;   // 当前观察器
    let quizScanTimer = null;  // 防抖：一次 DOM 变更可能触发大量 record

    // ⚠️ 观察目标必须是 document.body，不能用 .player-video。
    //    实测：题库容器 .gxb-video-quiz 常与 .player-video 是【兄弟节点】，
    //    观察 .player-video（即使加 subtree:true）永远收不到题库注入，
    //    表现为「观察器挂上了但一直不动」。观察 body 可彻底摆脱层级假设。
    function attachQuizObserver() {
        if (!cfg('autoQuiz')) return;
        if (quizObserver) return; // body 不会被替换，挂一次就够

        const observer = new MutationObserver(() => {
            // body 级观察会收到全页所有 DOM 变更，必须防抖，
            // 否则答题过程中页面自身的更新会反复触发回调造成重复点选。
            if (quizScanTimer) return;
            quizScanTimer = setTimeout(() => {
                quizScanTimer = null;
                answerQuizIfPresent();
            }, 300);
        });

        observer.observe(document.body, { childList: true, subtree: true });
        quizObserver = observer;
        log('答题监听已挂载（body 级）');

        // ⚠️ 关键：题目若在挂载前就已渲染好，之后没有 DOM 变更，回调永远不会触发。
        //    （站点上题库通常是异步注入所以看不出来，但静态渲染/秒开时会完全失效。）
        //    所以挂载后立刻主动扫一次。
        answerQuizIfPresent();
    }

    // 已交卷的题库元素，避免同一份题被重复提交
    const quizDone = new WeakSet();

    // 本次题库已答的题数。不能直接用 questions.length ——
    // 站点一次只渲染一题，length 恒为 1，日志会永远报「共 1 题」（误导）。
    let quizAnsweredCount = 0;

    // 逐题作答的状态机。
    // 原实现把「点选项」和「点下一题」写在同一个 for 循环里 —— 但点完下一题后
    // DOM 已经换了，原先抓到的 items/options 引用全部失效，于是除第一题外都点空。
    // 这里改成：每次只处理「当前可见的那一题」，答完点下一题，然后重新扫描 DOM。
    let quizBusy = false;

    // 选择器兜底：同一个语义给多个候选，命中任一即可。
    // （平台类名可能带 .gxb-btn_ / .gxb-btn 这类历史遗留差异）
    // 选择器兜底：同一个语义给多个候选，命中任一即可。
    // 三层策略：精确类名 → 模糊类名（class*）→ 语义文字/结构。
    // 站点类名有 .gxb-btn_ / .gxb-btn / .gxb-btn-xxx 等历史差异，而且可能随时改，
    // 所以最后一定要有「不看类名」的兜底。
    const SEL = {
        quizBody: [
            '.gxb-video-quiz-body', '.quiz-content', '.video-quiz-body', '.question-wrap',
            '[class*="quiz-body"]', '[class*="question-list"]',
        ],
        question: [
            '.question-item', '.quiz-item', '.examination-item', '[class*="question-item"]',
            '[class*="ques-item"]',
        ],
        correct: [
            '.correctAnswer', '[data-correct]', '.right-answer', '[class*="correct"]',
            '[data-answer]', '[data-right]',
        ],
        options: [
            '.answer-wap .answer i[answer_id]', '.answer i[answer_id]', 'i[answer_id]',
            '[class*="answer"] i[answer_id]', '[answer_id]', '[data-answer-id]',
        ],
        nextBtn: [
            '.gxb-video-quiz .gxb-icon-next', '.gxb-icon-next', '.next-question',
            '[class*="icon-next"]', '[class*="next-question"]',
        ],
        submitBtn: [
            '.gxb-video-quiz-footer .gxb-btn_.submit',
            '.gxb-video-quiz-footer .gxb-btn.submit',
            '.gxb-video-quiz-footer .submit',
            '.gxb-btn_.submit', '.gxb-btn.submit',
            '[class*="footer"] [class*="submit"]',
            '[class*="quiz"] [class*="submit"]',
        ],
        playerBtn: [
            '.gxb-video-quiz-footer .gxb-btn_.player',
            '.gxb-video-quiz-footer .gxb-btn.player',
            '.gxb-video-quiz-footer .player',
            '.gxb-btn_.player', '.gxb-btn.player',
            '[class*="footer"] [class*="player"]',
            '[class*="quiz"] [class*="player"]',
        ],
    };

    // 按钮语义文字：类名全猜不中时的最后一道防线
    const BTN_TEXT = {
        submit: ['交卷', '提交', '确定', '完成', 'submit'],
        player: ['继续播放', '继续学习', '继续', '播放', '关闭', 'player', 'close'],
        next: ['下一题', '下一页', 'next'],
    };

    // 在给定根节点下按「可见 + 文字匹配」找按钮（兜底用，不看类名）
    function findByText(kind, root = document) {
        const wants = BTN_TEXT[kind] || [];
        if (!wants.length) return null;
        const cands = root.querySelectorAll('i, a, button, span, div[class*="btn"]');
        for (const el of cands) {
            if (el.offsetParent === null) continue;      // 只认可见的
            const t = (el.innerText || el.textContent || '').trim();
            if (!t || t.length > 8) continue;            // 按钮文字不会长
            if (wants.some((w) => t === w || t.includes(w))) return el;
        }
        return null;
    }

    function pickOne(cands, root = document) {
        for (const c of cands) {
            const el = root.querySelector(c);
            if (el) return el;
        }
        return null;
    }

    function pickAll(cands, root = document) {
        for (const c of cands) {
            const els = root.querySelectorAll(c);
            if (els.length) return [...els];
        }
        return [];
    }

    // 从正确答案元素解析出要点的选项下标（支持 对/错 判断题）
    function parseAnswerIndices(correctEl) {
        const raw =
            correctEl.getAttribute('data') ||
            correctEl.getAttribute('data-correct') ||
            correctEl.dataset.correct ||
            '';
        return String(raw)
            .split('')
            .map((ch) => {
                if (ch === '对' || ch === '是' || ch === 'T') return 0;
                if (ch === '错' || ch === '否' || ch === 'F') return 1;
                const n = ch.codePointAt(0) - 'A'.codePointAt(0);
                return n >= 0 ? n : -1;
            })
            .filter((n) => n >= 0);
    }

    // 找「当前正在做的这一题」。
    // ⚠️ 不以容器为前置条件：容器类名站点随时会改（实测 .gxb-video-quiz-body / .qq-body
    //    / 甚至没有容器），一旦容器选择器失配，整条答题链路直接断掉。
    //    真正的可靠锚点是题目/选项本身 —— [answer_id] 这种属性站点改不了，
    //    改了它自己的后端也收不到答案。
    function findCurrentQuestion() {
        // 1) 优先用「题目」选择器（多题时取当前可见那一题）
        let questions = [];
        for (const sel of SEL.question) {
            const els = document.querySelectorAll(sel);
            if (els.length) { questions = [...els]; break; }
        }

        // 2) 题目选择器全不中 → 用选项反推题目：每个 [answer_id] 往上找最近的可辨识父级
        if (!questions.length) {
            const optEls = document.querySelectorAll('[answer_id], [data-answer-id]');
            const seen = new Set();
            optEls.forEach((o) => {
                let p = o.parentElement;
                // 往上找 4 层，取第一个「包含正确答案标记」的祖先作为题目容器
                for (let i = 0; i < 5 && p && p !== document.body; i++) {
                    if (p.querySelector && pickOne(SEL.correct, p)) {
                        if (!seen.has(p)) { seen.add(p); questions.push(p); }
                        break;
                    }
                    p = p.parentElement;
                }
            });
        }

        if (!questions.length) return null;
        const current = questions.find((it) => it.offsetParent !== null) || questions[0];
        if (!current) return null;
        const correctEl = pickOne(SEL.correct, current);
        if (!correctEl) return null;   // 正确答案还没渲染 → 等下一轮
        return { current, correctEl, total: questions.length };
    }

    function answerQuizIfPresent() {
        if (!cfg('autoQuiz')) return;
        if (quizBusy) return;

        /* 【v2.5.12】整卷测验页 → 【绝不自动作答】。
         *
         * 为什么必须拦在【最前面】（在 findCurrentQuestion 之前）：
         *   旧逻辑在这里会取到「第一个可见的题」= 第 1 题，点完选项后
         *   因为找不到「下一题」按钮而**直接点 #quizSubmit 交卷** ——
         *   等于把只答了 1 题的卷子交掉，白烧一次机会。
         *
         * ⚠️ 注意：拦的是「整卷 + 无正确答案」这种页面。
         *    视频弹题（一次一题、有 .correctAnswer）不满足条件，不受影响。
         *    万一站点改版让本判据失效，结果只是**退回旧行为**（可见），
         *    而不是整个答题功能静默失效 —— 这正是判据方向的选择。 */
        const wholePaper = isWholePaperQuizPage();
        if (wholePaper.whole) {
            warnWholePaperQuizPage(wholePaper);
            return;
        }

        const found = findCurrentQuestion();
        if (!found) return;
        const { current, correctEl } = found;

        // 去重键：优先用容器元素；没有容器就用「选项集合所在的最外层」。
        // 用 current 本身当键也行 —— 只要它还在文档里，就不会重复处理。
        const body = pickOne(SEL.quizBody) || document.body;
        if (quizDone.has(body) && quizDone.has(current)) return;

        quizBusy = true;
        try {
            const indices = parseAnswerIndices(correctEl);
            const options = pickAll(SEL.options, current);
            let clicked = 0;
            indices.forEach((idx) => {
                if (options[idx]) { options[idx].click(); clicked++; }
            });
            quizAnsweredCount++;
            log('已作答第 ' + quizAnsweredCount + ' 题，本轮选中 ' + clicked + ' 项');

            // 还有下一题 → 点「下一题」，等 DOM 刷新后由观察器再次进来。
            // ⚠️ 不要用 questions.length 推断「是否最后一题」：很多站点（含高校邦）
            //    一次只把【当前这一题】渲染进 DOM，length 恒为 1，会导致每题都被
            //    误判成「最后一题」而直接交卷。
            //    可靠信号是「下一题按钮是否存在」。
            const nextBtn =
                pickOne(SEL.nextBtn, body) || pickOne(SEL.nextBtn) ||
                findByText('next', body) || findByText('next');
            if (nextBtn && visible(nextBtn)) {
                nextBtn.click();
                quizBusy = false;
                return; // 下一题交给下一轮扫描（观察器会因 DOM 变更再次进来）
            }

            // 最后一题 → 交卷。
            // ⚠️ 交卷按钮在 .gxb-video-quiz-footer 内，它是 .gxb-video-quiz-body 的
            //    【兄弟节点】而不是子节点，所以不能只在 body 里找。
            const submitBtn =
                pickOne(SEL.submitBtn, body) || pickOne(SEL.submitBtn) ||
                findByText('submit', body) || findByText('submit');
            if (submitBtn) {
                submitBtn.click();
                quizDone.add(body);
                quizDone.add(current);
                quizSubmittedPaths.add(location.pathname);   // 【v2.4.0】供跳章判定
                log('已自动作答并交卷，本次共答 ' + quizAnsweredCount + ' 题');
                quizAnsweredCount = 0;
                setTimeout(() => {
                    const playerBtn =
                        pickOne(SEL.playerBtn, body) || pickOne(SEL.playerBtn) ||
                        findByText('player', body) || findByText('player');
                    playerBtn && playerBtn.click();
                }, 1000);
            } else {
                // 把「页面上所有像按钮的东西」列出来，方便用户一眼看出真实类名
                const seen = new Set();
                const dump = [];
                document.querySelectorAll('i, a, button').forEach((el) => {
                    if (el.offsetParent === null) return;
                    const t = (el.innerText || '').trim();
                    if (!t || t.length > 10) return;
                    const k = t + '|' + el.className;
                    if (seen.has(k)) return;
                    seen.add(k);
                    dump.push('<' + el.tagName.toLowerCase() + ' class="' + el.className + '">' + t);
                });
                console.warn(
                    '[高校邦助手] 找不到交卷按钮。请把下面这份可见按钮清单（连同答题页 outerHTML）发给开发者：\n' +
                    dump.slice(0, 25).join('\n')
                );
            }
        } catch (e) {
            console.error('[高校邦助手] 答题异常：', e);
        } finally {
            quizBusy = false;
        }
    }

    /* ============================================================
     *  八之二、【v2.5.13】整卷测验页：AI 自动作答 + 交卷
     *
     *  与上面视频弹题的 answerQuizIfPresent 是**两条独立链路**：
     *    视频弹题：一次一题 + 页面下发正确答案 ⇒ 抄答案，逐题推进
     *    整卷测验：整卷一次渲染 + 答案在服务端 ⇒ 只能 AI 答，一次交卷
     *
     *  ⚠️ 为什么不复用：两者的「完成动作」完全不同。把弹题逻辑套过来会
     *     「只答一题就交卷」（v2.5.12 已加守卫拦住，那条守卫在这里是前提）。
     * ============================================================ */

    /* ---- 读卷：把整卷读成结构化数据（4 种题型都覆盖）----
     *
     * 依据站点自己的模板代码（view/student/quiz/type/*.js，实测有 4 个）：
     *   multiple_choice  单选  i.gxb-icon-radio[answer_id]  （选中加 .checked）
     *   true_false       判断  i.gxb-icon-radio[answer_id]
     *   multiple_answers 多选  i.gxb-icon-check[answer_id]  （注意是 check）
     *   fill_in_blank    填空  input[type=text]
     *
     * ⚠️ 填空题：站点自己的收集函数（controller 里的 c()）**根本不处理它**
     *    （连 text 都不收集）⇒ 本脚本也不作答，如实报告「填空题无法自动作答」，
     *    让用户知道这套题有他必须手动的部分。**不猜、不填。**
     */
    function readQuizPaper() {
        const wraps = pickAll(['.answer-wap']);
        if (!wraps.length) return null;

        const questions = wraps.map((w, i) => {
            const type = w.getAttribute('question_type') || '';
            const qid = w.getAttribute('question_id') || '';
            /* 题干：优先 .quiz-title 里的 <p>（去掉「1. 」这种序号不影响 AI 理解）*/
            const item = w.closest('.question-item') || w.parentElement || w;
            const titleEl = pickOne(['.quiz-title p', '.quiz-title'], item);
            const title = titleEl ? (titleEl.innerText || '').trim() : '';

            /* 选项：单选/判断/多选都是 i[answer_id]；填空是 input */
            let opts = [];
            if (type === 'fill_in_blank') {
                opts = pickAll(['input[type="text"]'], w).map((inp) => ({
                    id: null, letter: '', text: '(填空题·需手动作答)',
                    el: inp, kind: 'text',
                }));
            } else {
                const iconSel = type === 'multiple_answers'
                    ? 'i.gxb-icon-check[answer_id]'
                    : 'i.gxb-icon-radio[answer_id]';
                const iconEls = pickAll([iconSel, 'i[answer_id]'], w);
                opts = iconEls.map((el, k) => {
                    const box = el.closest('.answer') || el.parentElement;
                    /* 选项文本：.answer 里除了图标还有 "A. <p>xxx</p>" */
                    let t = '';
                    if (box) {
                        t = (box.innerText || '').replace(/\s+/g, ' ').trim();
                    }
                    return {
                        id: el.getAttribute('answer_id'),
                        letter: String.fromCharCode(65 + k),
                        text: t,
                        el, kind: 'icon',
                        iconCls: String(el.className || ''),
                    };
                });
            }
            return { idx: i + 1, qid, type, title, options: opts };
        });

        /* 只留「能作答」的题（有 icon 选项的）*/
        const answerable = questions.filter((q) => q.options.some((o) => o.kind === 'icon'));
        const blank = questions.filter((q) => q.type === 'fill_in_blank');
        return { questions, answerable, blankCount: blank.length };
    }

    /* ---- 把整卷拼成给 AI 的提示词 ----
     * 一次发整卷（不是逐题）：这些题是同一篇材料的理解题，
     * 带全上下文答准确率更高（实测 100001 五题全围绕同一则新闻）。
     */
    function buildQuizPrompt(paper) {
        const lines = [];
        lines.push('下面是一份在线测验的完整题目。请逐题作答，只输出一个 JSON 对象，不要任何解释、不要 markdown 代码块。');
        lines.push('');
        lines.push('输出格式（严格照抄这个结构）：');
        lines.push('{"answers":[{"question_id":"900001","answer_ids":["800001"]}]}');
        lines.push('');
        lines.push('规则：');
        lines.push('- answer_ids 必须是数组；单选/判断只放 1 个 id，多选放多个 id。');
        lines.push('- id 必须从下面题目给出的「选项 id」里原样抄，不得编造、不得改写。');
        lines.push('- 每题都必须给答案，不许留空、不许写"不确定"。');
        lines.push('');
        lines.push('题目：');
        paper.answerable.forEach((q) => {
            /* 【v2.5.13d】原来这里写成 q.typeCN —— 算的是局部变量 typeCN，
             * 用的却是对象属性 q.typeCN（不存在）⇒ 题型恒为 undefined，
             * 提示词里全是「[undefined]」。题型是模型判单选/多选的唯一线索。 */
            const typeCN = { multiple_choice: '单选', true_false: '判断', multiple_answers: '多选' }[q.type] || q.type;
            lines.push('');
            lines.push('[' + typeCN + '] question_id=' + q.qid);
            lines.push(q.title);
            q.options.forEach((o) => {
                if (o.kind !== 'icon') return;
                lines.push('  ' + o.letter + '. (id=' + o.id + ') ' + o.text);
            });
        });
        return lines.join('\n');
    }

    /* ---- 从 AI 回复里抽出 JSON ----
     * 模型经常包一层代码块围栏（三个反引号 + json）或者说两句废话，
     * 所以：先剥代码块，再取第一个 { 到最后一个 } 的子串。
     */
    function extractJson(txt) {
        if (!txt) return null;
        let t = String(txt).trim();
        t = t.replace(/^\x60\x60\x60(?:json)?/i, '').replace(/\x60\x60\x60$/i, '').trim();
        const a = t.indexOf('{');
        const b = t.lastIndexOf('}');
        if (a < 0 || b <= a) return null;
        try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
    }

    /* ---- 校验 AI 给的答案 ----（这是「不猜」的落点）
     *
     * 判据：宁可整卷不交，也不交一份 id 对不上的卷。
     * 校验三件事，任一不过就返回 null + 原因：
     *   ① 每题都有答案（题数对得上）
     *   ② 每个 answer_id 都能在这道题的选项里找到
     *   ③ 单个 question 的至少 1 个 answer，多选不限
     */
    function validateAIAnswers(paper, parsed) {
        if (!parsed || !Array.isArray(parsed.answers)) {
            return { ok: false, why: 'AI 没有返回 {answers:[...]} 结构' };
        }
        const byQid = new Map();
        parsed.answers.forEach((a) => {
            if (a && a.question_id) byQid.set(String(a.question_id), a.answer_ids || a.answerIds || []);
        });

        const picked = [];   // [{ q, ids:[], els:[] }]
        const missing = [];
        const badId = [];
        paper.answerable.forEach((q) => {
            const ids = byQid.get(q.qid);
            if (!ids || !ids.length) { missing.push(q.idx); return; }
            const els = [];
            const okIds = [];
            ids.forEach((id) => {
                const opt = q.options.find((o) => String(o.id) === String(id));
                if (opt) { els.push(opt.el); okIds.push(opt.id); }
                else badId.push('第' + q.idx + '题 id=' + id);
            });
            /* 多选允许部分命中（AI 可能多给一个错的），但至少要有一个能对上。
             * ⚠️ 不能"有一个对上就凑合"—— 多选本来就要点多个。
             *    这里只要求「至少一个 id 存在」，剩下的交给 AI。 */
            if (!els.length) { missing.push(q.idx); return; }
            picked.push({ q, ids: okIds, els });
        });

        if (missing.length) {
            return { ok: false, why: '这些题 AI 没给答案或给的全是无效 id：第 ' + missing.join('、') + ' 题' };
        }
        if (badId.length) {
            console.warn('[高校邦助手] AI 给的 id 里有对不上的（已忽略这些 id）：' + badId.join('；'));
        }
        return { ok: true, picked, badId };
    }

    /* ---- 真正作答（点选项）----
     *
     * ⚠️⚠️ 【v2.5.13b · Bug2 修复】别再同步读 `.checked` 当判定。
     *
     * 实测（_diag-v2513.mjs，带 setTimeout(0) 的观测）：
     *   前 4 次点击读到的 className 是【旧的】（null），第 5 次才读到 checked。
     * 根因：站点自己的处理器（复刻自 controller/student/quiz.js 的
     *   `t.toggleClass("checked")`）注册在 **document 冒泡阶段**，
     *   而 el.click() 是**同步派发** —— click() 返回时监听器还没跑完。
     *   ⇒ 同步读类名读到的是旧值。
     *
     * 这属于「先怀疑测量，再怀疑被测物」：不是站点没选中，是我读早了。
     * 按那个读数写判定会产生**假失败**（「点了却报未点中」），
     * 于是脚本拒绝交卷 —— 这次碰巧落在安全方向，但同样说明读数不可信。
     *
     * ⇒ 判据换成**可观测的、与时机无关的副作用**：
     *    ① 元素仍在 DOM 里（不是已被卸载的陈旧引用）
     *    ② 事件真的派发出去了（click() 返回且改了类名或至少没抛错）
     *    真正的「选中态」交给 await 一个宏任务之后**只用于播报**，不用于放行判断。
     */
    function applyQuizAnswers(picked) {
        let clicked = 0;
        const failed = [];
        picked.forEach((p) => {
            let perQ = 0;
            p.els.forEach((el) => {
                /* 前置：陈旧引用（DOM 已被换掉）不能算点成功 */
                if (!el.isConnected) return;
                const before = String(el.className || '');
                try {
                    el.click();
                } catch (e) {
                    return;
                }
                /* 判定①：元素还在（没被卸载） */
                if (!el.isConnected) return;
                perQ++; clicked++;
                /* 记一笔供播报用（不作为放行依据） */
                if (el.dataset) el.dataset.gxbClickedFrom = before;
            });
            if (!perQ) failed.push('第' + p.q.idx + '题');
        });
        return { clicked, failed };
    }

    /* 作答后的「选中态」回读 —— 只用于播报与自检，**不参与是否交卷的判断**。
     * 必须 await 一个宏任务，等站点自己的冒泡处理器跑完。 */
    async function readCheckedCount() {
        await new Promise((r) => setTimeout(r, 60));
        return document.querySelectorAll('.answer i.checked').length;
    }

    /* ---- 交卷：两层交互（点提交 → 点确认弹窗）----
     *
     * ★ 实测教训（2026-09-21）：只点 #quizSubmit **不会提交**，
     *   它只弹一个 gxb.confirm 确认框。必须再点 .gxb-btn-sure（文本「确认」）。
     *   只点第一层 ⇒ 什么都没发生。**判据 44。**
     *
     * 返回 Promise，resolve 为 { ok, why }。
     */
    async function submitQuizPaper() {
        const btn = pickOne(['#quizSubmit', '.quiz-option .gxb-btn-pri']);
        if (!btn) return { ok: false, why: '找不到提交按钮 #quizSubmit' };

        btn.click();

        /* 【v2.5.14 · Bug 修复】确认按钮类名实测是 `gxb-sure` 而不是 `gxb-btn-sure`。
         *   真机原文（2026-09-21 落盘 验证-交卷v2-确认弹窗.json）：
         *       <div class="gxb-dialog-footer">
         *         <div class="btn btn-default gxb-sure">确认</div>
         *         <div class="btn btn-default gxb-cancel">取消</div>
         *   旧写法找的 .gxb-btn-sure 在真机上【0 命中】，全靠下面的兜底 ——
         *   而兜底要求弹窗【已经可见】，弹窗晚出来一点（动画/网络）就整个失败。
         *   ⇒ 现在：主选择器补上真机类名，且把「只等一次 800ms」改成【轮询最多 ~3.2s】。 */
        const SURE_SEL = [
            '.gxb-dialog-footer .gxb-sure', '.gxb-dialog-footer .gxb-btn-sure',
            '.gxb-sure', '.gxb-btn-sure',
        ];
        function findSure() {
            let el = pickOne(SURE_SEL);
            if (el) return el;
            /* 兜底：在可见弹窗容器里按文本找「确认」
             * 注意不能只按文本找 —— 页面上可能别处也有"确认"二字。 */
            const roots = [...document.querySelectorAll('[class*="dialog"],[class*="confirm"],[class*="pop"]')]
                .filter((e) => e.offsetParent !== null);
            for (const r of roots) {
                const hit = [...r.querySelectorAll('i, a, button, div')]
                    .find((b) => /^(确认|确定|继续提交|是)$/.test((b.innerText || '').trim()));
                if (hit) return hit;
            }
            return null;
        }
        let sure = null;
        /* 【v2.5.14】轮询等弹窗：16 次 × 200ms ≈ 3.2s。
         *   为什么要等 —— 旧版只等 800ms 一次，弹窗容器还在 display:none
         *   或 visibility:hidden 时兜底必然落空（探针实测 V2/V3），
         *   然后就报「交卷失败」，用户白勾一次答案。 */
        for (let i = 0; i < 16 && !sure; i++) {
            await new Promise((r) => setTimeout(r, 200));
            sure = findSure();
        }
        if (!sure) return { ok: false, why: '点了提交后等了 3.2 秒，仍没等到确认弹窗的「确认」按钮（若页面上确实弹了框，请手动点一次「确认」）' };

        sure.click();
        return { ok: true };
    }

    /* ---- 整卷流程主函数 ---- */
    let paperState = 'idle';   // idle | working | done | failed
    /* 【v2.5.13c】失败原因。⚠️ 必须声明：本 IIFE 是 'use strict'，
     *   赋值给未声明变量会【抛 ReferenceError】—— 而第一处赋值就在 try 的首句，
     *   catch 里又赋一次 ⇒ catch 自己再抛 ⇒ 变成 unhandledrejection，
     *   用户屏幕上只剩「⏸ AI 作答中…」，一个字的原因都看不到。 */
    let paperReason = '';

    /* 【v2.5.13b · Bug1 修复】失败【必须终局】。
     *
     * 实测（_diag-v2513.mjs）：入口守卫只拦了 working/done，没拦 failed，
     * 而本函数挂在 1000ms 主循环上 ⇒ 一次失败会变成「每秒重试一次」：
     *     @8099ms 已点选 0 项 → 停止，不交卷
     *     @9076ms 共 5 题…      ← 1 秒后又来
     *
     * ⚠️ 这是【危险方向】的错误：AI 每次返回可能不同，某一秒返回合法答案
     *    就会去点选项、交卷 —— 把「一次失败」变成「赌运气每秒重试」。
     *    对只剩 1 次机会的套，这是灾难。
     *
     * 为什么不直接复用 paperState：SPA 切换页面时它不会重置，
     * 会造成「上一页失败 ⇒ 下一页整页不动」（静默失效）。
     * ⇒ 两把锁都要：状态锁本轮，路径集合锁本页。 */
    function paperAlreadyHandled() {
        return paperState === 'working' || paperState === 'done' || paperState === 'failed';
    }
    /* 本页已处理过（成功/失败都算）—— 换页自动失效 */
    const paperHandledPaths = new Set();
    /* 【v2.5.17】换页时重置「详情已看过」——
     *   否则在新页面上失败，用户点按钮却直接触发了暂停，看不到新原因。
     *   （paperReasonFull 由 warnPaper 覆盖写，这里只管「看过没」。） */
    function resetPaperReasonSeen() { paperReasonSeen = false; }

    async function handleWholePaperQuiz() {
        if (!cfg('autoQuizPaper')) return;
        if (paperAlreadyHandled()) return;          // 【v2.5.13b】失败也拦（终局）
        const path = location.pathname;
        if (paperHandledPaths.has(path)) return;    // 本页已处理过（成功/失败都算）

        /* 只在确认是整卷测验页时才动（守卫的同一个判据）*/
        const info = isWholePaperQuizPage();
        if (!info.whole) return;

        /* ---- 【v2.5.19】★安全守卫：本卷【已经提交过】⇒ 一个字都不点 ----
         *
         * 为什么必须有（用户实测 100005，只剩 1 次机会）：
         *   已提交的卷面上选项**仍然是可点的** `<i class="gxb-icon-radio">`，
         *   readQuizPaper() 照样读得出「可作答的题」⇒ 不拦就会**再答一遍**。
         *   真机上 #quizSubmit 已不存在（submitQuizPaper 会失败），但：
         *     · 脚本会照 AI 的答案去点勾，把只读的卷面改乱（用户看不懂）；
         *     · 右下角会报「需手动：交卷失败…」—— 事实恰恰相反（100 分已完成）；
         *     · 站点哪天在已提交页保留提交键 ⇒ 就成了**真·烧机会**（不可撤销）。
         *
         * ⚠️ 判据 43：认得出已提交才拦。认不出 ⇒ 退回旧行为（可见、可报）。
         * ⚠️ 播报交给 reportSubmissionResult()（它同一轮就会跑），
         *   这里【不】写按钮文案，避免两处写同一块位置（判据 30：一个真相）。 */
        if (readSubmittedState()) {
            paperState = 'done';
            paperHandledPaths.add(path);
            return;
        }

        paperState = 'working';
        resetPaperReasonSeen();
        try {
            /* ---- 1) 读卷 ---- */
            const paper = readQuizPaper();
            if (!paper || !paper.answerable.length) {
                /* 「读不到」与「读到了但没答案」是两种状态（判据 27）*/
                paperState = 'failed';
                paperReason = '读不到题目（页面上有 ' + (paper ? paper.questions.length : 0) +
                    ' 个答案区，但没有一个含可点的选项）';
                paperHandledPaths.add(path);
                warnPaper(paperReason);
                return;
            }

            /* ---- 2) 交代清楚这次要干什么（不可撤销前的告知）---- */
            const attempt = readAttemptsText();
            log('整卷测验：共 ' + paper.questions.length + ' 题，其中可自动作答 ' +
                paper.answerable.length + ' 题' +
                (paper.blankCount ? '（含 ' + paper.blankCount + ' 题填空题，需手动作答）' : '') +
                (attempt ? '；' + attempt : ''));
            /* 1 次机会的套：额外醒目警告（用户明确说过「只许成功不许失败」）*/
            if (attempt && /还有\s*1\s*次/.test(attempt)) {
                console.warn('[高校邦助手] ⚠️⚠️ 本套测验【只剩 1 次机会】，AI 一旦答错就没有第二次。' +
                    '\n如果你想自己手动做，请立刻点右下角暂停键，或关掉面板「设置」「测验自动作答」。');
            }
            updatePauseButtonHint('AI 作答中…', 2);

            /* ---- 3) 问 AI ---- */
            const prompt = buildQuizPrompt(paper);
            let reply;
            try {
                /* 【v2.5.16】这句 extraSystem 与面板「设置」 第 2 步【逐字一致】，
                 *   抽成常量避免两处漂移（改一处漏一处 = 测试就不再忠实地反映真实路径）。 */
                reply = await callAI(prompt, QUIZ_EXTRA_SYSTEM);
            } catch (e) {
                paperState = 'failed';
                paperReason = 'AI 调用失败：' + (e && e.message ? e.message : String(e));
                paperHandledPaths.add(path);
                warnPaper(paperReason);
                return;
            }

            /* ---- 4) 校验（不合法就一个字都不点）---- */
            const parsed = extractJson(reply);
            const v = validateAIAnswers(paper, parsed);
            if (!v.ok) {
                paperState = 'failed';
                paperReason = 'AI 返回的答案不可用：' + v.why + '\n（已【放弃作答并停止】—— 不会用残缺答案凑合交卷）';
                paperHandledPaths.add(path);
                warnPaper(paperReason);
                console.warn('[高校邦助手] AI 原始回复（供排查）：\n' + String(reply).slice(0, 1500));
                return;
            }

            /* ---- 5) 作答 ---- */
            const applied = applyQuizAnswers(v.picked);
            /* 迟读一次真实选中数，只用于播报（放行判断已在上一步完成） */
            const checkedNow = await readCheckedCount();
            log('整卷测验：已点选 ' + applied.clicked + ' 项，覆盖 ' + v.picked.length + ' 题' +
                '；页面上实测选中 ' + checkedNow + ' 项' +
                (applied.failed.length ? '；未点中：' + applied.failed.join('、') : ''));

            if (applied.failed.length) {
                /* 有题没点中 ⇒ 不交卷（判据 25：不拿残缺卷凑合）*/
                paperState = 'failed';
                paperReason = '有 ' + applied.failed.length + ' 题的选项没能点中（' +
                    applied.failed.join('、') + '）。已【停止，不交卷】—— 请手动完成后再自行提交。';
                paperHandledPaths.add(path);
                warnPaper(paperReason);
                return;
            }

            /* 填空题的存在不影响交卷，但要如实告诉用户 */
            if (paper.blankCount) {
                console.warn('[高校邦助手] 本套有 ' + paper.blankCount +
                    ' 题填空题，脚本【不会填】（站点自己的提交逻辑也不收集填空题答案）。' +
                    '建议：这些题留空交卷会扣分，若你在意就先手动填上再交。');
            }

            /* ---- 6) 交卷（两层）---- */
            log('整卷测验：正在交卷…');
            const sub = await submitQuizPaper();
            if (!sub.ok) {
                paperState = 'failed';
                paperReason = '交卷失败：' + sub.why +
                    '（答案已勾选但未提交，你可以手动点一次「提交」）';
                paperHandledPaths.add(path);
                warnPaper(paperReason);
                return;
            }

            paperState = 'done';
            paperHandledPaths.add(path);
            log('整卷测验：已提交，等待结果页…');
            updatePauseButtonHint('已交卷 · 等结果', 2);
        } catch (e) {
            /* 【v2.5.13c】catch 自己绝不能再抛。
             *   历史 bug：这里写 paperReason = '异常：…'，而 paperReason 当时未声明
             *   ⇒ 本 catch 反而成了【第二次抛错】，连"停了、原因是什么"都没播报出去。 */
            const _msg = (e && e.message ? e.message : String(e));
            try {
                paperState = 'failed';
                paperReason = '异常：' + _msg;
                paperHandledPaths.add(location.pathname);
            } catch (_e2) { /* 状态记账失败也不能吞掉播报 */ }
            try { warnPaper('异常：' + _msg); } catch (_e3) { /* 播报失败就只剩 console */ }
            console.error('[高校邦助手] 整卷测验异常：', e);
        }
    }

    /* 整卷测验的播报（console.warn + 按钮），失败方向：一定要说清"停在哪一步" */ /*v2.5.14*/
    /* 【v2.5.17】失败详情保留全文，供「点按钮看完整原因」。
     *   为什么要它：用户明确说过「不开 F12」——
     *   光把整段原因 console.warn 出去，等于没告诉他。 */
    let paperReasonFull = '';
    /* 看过一次就不再拦点击，避免按钮「点不动」（暂停入口必须始终有效）。 */
    let paperReasonSeen = false;

    /* 【v2.5.17】从整段原因里挑出**可执行的动作**，作为按钮文案。
     *
     * 用户实测把这行暴露了出来：按钮显示
     *     ⏸ 需手动：AI 调用失败：返回内容为空（HTTP 200…
     * —— 取【首行】前 24 字，而首行只说【现象】；
     *    真正能行动的两行（原因 / 建议）**全被截掉了**。
     *
     * 判据 29（报错要给出动作）的延伸：
     *   **按钮空间只够一句话 ⇒ 那句话必须是「动作」，不是「现象」。**
     *   现象（返回内容为空）用户看不懂也做不了；
     *   动作（换成非推理模型）他立刻能做。 */
    function briefPaperAction(reason) {
        const t = String(reason || '');
        /* ① 内容审核 —— 要排在「换模型」之前：它的文案里也含「换个模型」，
         *   顺序反了会让两种不同原因显示成同一句话（判据 30：原因是可区分的）。 */
        if (/内容审核|content_filter/.test(t)) return '被内容审核拦了：换个说法或模型';
        /* ② 地址 / 端点问题 */
        if (/不是合法 JSON|流式/.test(t)) {
            return '地址要填到 /chat/completions';
        }
        /* ③ 鉴权 / 模型名 */
        if (/HTTP 40[13]/.test(t)) return 'Key 或用不了：见面板「设置」的测试结果';
        if (/model not found|HTTP 404/.test(t)) return '模型名不对：见面板「设置」的测试结果';
        /* ④ 额度不够 / 思考吃掉了额度 —— 最常见的可自愈场景
         *   【v2.5.18】文案改了：不再说「换模型」（用户照做没用，见 ADVICE 注释）。
         *   现在指向【真正的开关】。 */
        if (/推理模型|max_tokens|reasoning_content|返回内容为空|思考/.test(t)) {
            return '已自动关思考：仍失败请重开一下';
        }
        /* ⑤ 读卷 / 校验 / 点选 / 交卷 等其它环节 —— 退回首行，但尽量留出信息量 */
        let brief = t.split('\n')[0].replace(/\s+/g, ' ').trim();
        if (brief.length > 18) brief = brief.slice(0, 17) + '…';
        return brief || '原因见按钮详情';
    }

    function warnPaper(reason) {
        console.warn('[高校邦助手] 【整卷测验·未自动作答】' + reason);
        /* 【v2.5.14 · 判据 29】失败原因也要写到按钮上。
         *   旧版按钮只有干巴巴一句「测验：需手动处理」，用户根本不知道停在
         *   【读卷 / AI 调用 / 答案校验 / 点选 / 交卷】哪一步，只能来问。
         *
         * 【v2.5.17】改为「**动作优先**」——
         *   原来取首行前 24 字，恰好截在「现象」上（实测：返回内容为空（HTTP 200…），
         *   把「原因」和「建议」两行全丢了）⇒ 用户只能来问。
         *   现在按钮上放的是**他立刻能做的那句话**。 */
        paperReasonFull = String(reason || '');
        updatePauseButtonHint('需手动：' + briefPaperAction(reason) + '（点这里看详情）', 2);
    }

    /* 读「还有 N 次有效提交机会」——只用于播报/警告，不参与判断 */
    function readAttemptsText() {
        const hits = [...document.querySelectorAll('body *')]
            .filter((e) => e.children.length === 0 && /还有\s*\d+\s*次|有效提交次数/.test(e.innerText || ''));
        return hits.length ? (hits[0].innerText || '').trim().replace(/\s+/g, ' ') : '';
    }

    /* 【v2.5.19b】元素**真的看得见**吗。
     *
     * ⚠️ 为什么这个函数非有不可：`pickOne()` 内部就是 `querySelector`，
     *   **完全不判可见性**。答题页上完全可能存在 `display:none` 的
     *   成绩容器 / 「再做一次」按钮（站点预留）。
     *   若拿它们当「已提交」的证据 ⇒ **整卷自动作答会静默失效**（判据 43 的最坏那侧）。
     *
     * ⚠️ 为什么不只用 offsetParent：它对 `position:fixed` 的元素恒为 null。
     *   成绩区块是普通流内 div（不受影响），但判据不押这一点 ——
     *   再看一眼 getClientRects()，两条任意成立即算可见。 */
    function isVisibleEl(el) {
        if (!el) return false;
        if (el.offsetParent !== null) return true;
        try {
            return el.getClientRects().length > 0;
        } catch (e) {
            return false;
        }
    }

    /* ============================================================
     *  【v2.5.19】readSubmittedState() —— **本卷是不是已经提交/批改过了**
     *
     *  为什么必须有它（两件事一起）：
     *    ① 功能：用户要「读取该状态并把完成情况显示于右下角」。
     *       真机上成绩是渲染在**答题页本体**（/quiz/<id>）上的，不是结果页。
     *    ② ★安全：已提交的卷面上选项**仍然是可点的 `<i class="gxb-icon-radio">`**，
     *       readQuizPaper() 照样读得出「可作答的题」⇒ 不拦就会**再答一遍**。
     *       用户这套只剩 1 次机会（真机：有效提交次数3次，已提交2次）——
     *       再烧一次不可撤销。
     *
     *  ── 识别为什么要用「组合特征」而不是单一类名（本项目判据 20）──
     *    真机类名会改。这里按「**出现任意一条强特征**」判已提交：
     *      · 页面里有 .quiz-submission-bg / .quiz-sub-finish / .quiz-sub-more
     *        （「本次得分…你还有 N 次测验机会」区块）
     *      · 卷面上有且只有「已完成」的批改标记（.true / .error 作为**既有**状态）
     *      · 提交键 #quizSubmit **不存在**、但「再做一次」/「查看解析」在
     *      · 页面内联脚本里的 submission.status === 'submitted'
     *        （真机：`var submission = {…"status":"submitted"…}`）
     *
     *  ⚠️ 判据 43（失败方向）：**认得出已提交才拦**。
     *     反面写法（「认不出就当已提交」）会让站点一改版就**整个测验功能静默失效**
     *     —— 用户以为脚本坏了，而且他发现不了原因。
     *     本实现最坏只是**退回旧行为**（又去点一次），看得见、报得出来。
     *
     *  返回：
     *    未提交 → null
     *    已提交 → { score, fullScore, right, wrong, answered, attemptsLeft, submittedAt, why }
     *              （读不到的字段一律 null，**不猜**）
     * ============================================================ */
    function readSubmittedState() {
        if (!/\/quiz\/\d+/.test(location.pathname)) return null;

        const why = [];

        /* ---- 特征 ①：成绩区块（最强、最直接）----
         *   ⚠️ 必须【真的可见】：隐藏的成绩容器不算（见 isVisibleEl 注释）。 */
        const subBox = pickOne(['.quiz-submission-bg', '.quiz-sub-more', '.quiz-sub-finish']);
        const subBoxShown = isVisibleEl(subBox);
        if (subBoxShown) why.push('页面上有成绩区块（' + (subBox.className || '').split(/\s+/)[0] + '）');

        /* ---- 特征 ②：内联的 submission.status ---- */
        /* 真机原文：var submission ={"score":"100.00",…,"status":"submitted",…};
         * ⚠️ 只读 <script> 里的**文本**，不 eval —— 这是只读勘察，
         *   把页面脚本文本拿去执行是另一类风险（本项目从不在页面里 eval 站点脚本）。 */
        const inlineText = [...document.querySelectorAll('script:not([src])')]
            .map((s) => s.textContent || '').join('\n');
        if (/"status"\s*:\s*"submitted"/.test(inlineText)) {
            why.push('页面内联数据里 status=submitted');
        }

        /* ---- 特征 ③：卷面已被批改（有对错标记）---- */
        const marked = document.querySelectorAll(
            '.answer i.true, .answer i.error, .gxb-icon-radio.true, .gxb-icon-radio.error,' +
            ' .gxb-icon-check.true, .gxb-icon-check.error').length;

        /* ---- 特征 ④：**没有**提交键，但有「再做一次 / 查看解析」----
         *   ⚠️ 先把 again 的查询放在 `!submitBtn` 之下：未提交的答题页上它
         *     每次主循环都白查一次，而且「有再做一次」这件事只有在
         *     **没有提交键**时才说明问题（两个都在 = 更可能是别的形态）。 */
        const submitBtn = pickOne(['#quizSubmit', '.quiz-option .gxb-btn-pri']);
        const again = submitBtn
            ? null
            : pickOne(['.quiz-sub-again', '.quiz-sub-see', '.quiz-sub-detail']);

        /* ⇒ 判据：**任意一条**强特征成立即认为已提交。
         *   ① 与 ② 独立于「站点有没有保留提交键」，最可靠。 */
        const submitted =
            subBoxShown ||
            /"status"\s*:\s*"submitted"/.test(inlineText) ||
            (marked > 0 && !submitBtn) ||
            (isVisibleEl(again) && !submitBtn);
        if (!submitted) return null;

        /* ---- 顺带把成绩读出来（只读，读不到就 null）---- */
        /* ⚠️ right/wrong 在下面按 .answer 范围重算 —— 这里的 marked 是
         *   【整页】范围的计数，含解析区，直接用会多算。 */
        const out = {
            score: null, fullScore: null, right: null, wrong: null,
            answered: 0, attemptsLeft: null, submittedAt: null, why: why.join('；'),
        };

        /* 得分：真机把分数放在 .focus 里（也可能只是纯数字节点） */
        const scoreBox = pickOne(['.quiz-sub-more', '.quiz-submission-bg', '.score-publish']);
        const scoreText = isVisibleEl(scoreBox)
            ? String(scoreBox.innerText || '').replace(/\s+/g, ' ') : '';
        const mScore = /本次得分\s*([\d.]+)\s*分/.exec(scoreText) ||
                       /得分\s*([\d.]+)\s*分/.exec(scoreText);
        if (mScore) out.score = mScore[1];
        const mFull = /满分\s*([\d.]+)\s*分/.exec(scoreText);
        if (mFull) out.fullScore = mFull[1];

        /* 剩余次数：真机「你还有 1 次测验机会」 */
        const mLeft = /还有\s*(\d+)\s*次/.exec(scoreText) ||
                      /还有\s*(\d+)\s*次/.exec(document.body.innerText || '');
        if (mLeft) out.attemptsLeft = mLeft[1];

        /* 交卷时间：真机「提交时间:2026-09-21 22:00」 */
        const timeBox = pickOne(['.quiz-sub-finish']);
        const timeText = timeBox ? String(timeBox.innerText || '').trim() : '';
        const mTime = /提交时间\s*[:：]?\s*([0-9\-:\s]+)/.exec(timeText);
        if (mTime) out.submittedAt = mTime[1].trim();

        /* 对/错题数：只统计**卷面**（.answer 里的批改图标），避免把解析区算进来 */
        const R = document.querySelectorAll('.answer i.true, .answer i.gxb-icon-radio.true,' +
            ' .answer i.gxb-icon-check.true').length;
        const W = document.querySelectorAll('.answer i.error, .answer i.gxb-icon-radio.error,' +
            ' .answer i.gxb-icon-check.error').length;
        out.right = R;
        out.wrong = W;
        out.answered = document.querySelectorAll('.answer-wap').length;
        return out;
    }

    /* 【v2.5.19】已提交页面的横幅文案（右下角）+ 完整详情（点按钮看）。
     *
     * 分成两段是有原因的（判据 29 的延伸，和 v2.5.17 的 warnPaper 同一个理由）：
     *   按钮位置**一行放不下**完整成绩，但用户「不开 F12」⇒ 必须有地方看到全文。
     *   ⇒ 按钮 = 「得分 X 分（Y/Z 题）· 还剩 N 次」；详情 = 逐项列清楚。 */
    function formatSubmittedBar(st) {
        if (!st) return '已完成';
        const bits = [];
        if (st.score !== null) {
            bits.push('得分 ' + st.score + (st.fullScore ? '/' + st.fullScore : '') + ' 分');
        }
        if (st.right !== null && st.answered) {
            bits.push(st.right + '/' + st.answered + ' 题对');
        }
        if (st.attemptsLeft !== null) {
            bits.push('还剩 ' + st.attemptsLeft + ' 次');
        }
        return bits.length ? bits.join(' · ') : '已提交';
    }

    function formatSubmittedDetail(st, quizId) {
        if (!st) return '本卷已完成。';
        const lines = [];
        lines.push('本套测验你已经提交过了 —— 不会再自动作答。');
        lines.push('');
        if (quizId) lines.push('测验编号：' + quizId);
        lines.push('得分：' + (st.score !== null
            ? st.score + (st.fullScore ? ' / 满分 ' + st.fullScore : '') + ' 分'
            : '（页面没给出分数）'));
        if (st.right !== null && st.answered) {
            lines.push('本次答对：' + st.right + ' 题' +
                (st.wrong ? '，答错 ' + st.wrong + ' 题' : '') + '（共 ' + st.answered + ' 题）');
        }
        if (st.attemptsLeft !== null) lines.push('剩余机会：' + st.attemptsLeft + ' 次');
        if (st.submittedAt) lines.push('交卷时间：' + st.submittedAt);
        lines.push('');
        lines.push('（识别依据：' + (st.why || '已提交') + '）');
        lines.push('');
        lines.push('——\n（再点一次这个按钮 = 暂停/继续所有自动功能）');
        return lines.join('\n');
    }

    /* ============================================================
     *  【v2.5.19】交卷结果播报 —— 从「只认结果页」扩到「**两种形态都认**」
     *
     *  旧版第一行就写了：
     *      if (!/\/quiz\/\d+\/submission\//.test(location.pathname)) return;
     *  ⇒ 只认识 /quiz/<id>/submission/。但用户实测（100005）是：
     *      **成绩直接渲染在答题页本体 /quiz/100005 上**（卷变成只读）。
     *  ⇒ 旧版在这页一个字都不播报，右下角一直写「运行中」= 对用户撒谎。
     *
     *  ⚠️ 判据 43：新判定写成「**认得出已提交形态才播报**」，
     *     而不是「URL 不是结果页就播报」——
     *     后者会把普通答题页（还没交卷）也当成已完成，播报出错误的成绩。
     * ============================================================ */
    function reportSubmissionResult() {
        const isResultPage = /\/quiz\/\d+\/submission\//.test(location.pathname);
        const path = location.pathname;

        /* ---- A) 结果页：沿用旧行为（读 .score-publish + 对错数）----
         *   ⚠️ 这条分支必须原样保留：它是 v2.5.13 的既有行为契约，
         *      而且结果页的 DOM 与答题页本体不同（没有 .quiz-sub-more）。 */
        if (isResultPage) {
            if (resultReportedPaths.has(path)) return;
            const score = pickOne(['.score-publish']);
            const answered = document.querySelectorAll('.answer-wap').length;
            const trues = document.querySelectorAll('.gxb-icon-radio.true, .gxb-icon-check.true').length;
            const errors = document.querySelectorAll('.gxb-icon-radio.error, .gxb-icon-check.error').length;
            if (!answered) return;
            resultReportedPaths.add(path);
            const txt = (score ? '得分 ' + (score.innerText || '').trim() : '（未读到得分）') +
                '；本次答对 ' + trues + ' 题、答错 ' + errors + ' 题（共 ' + answered + ' 题）';
            log('测验结果：' + txt);
            updatePauseButtonHint('测验完成 · ' + txt, 2);
            submittedDetail = '测验结果页：\n\n' + txt + '\n\n——\n（再点一次这个按钮 = 暂停/继续所有自动功能）';
            submittedDetailSeen = false;
            return;
        }

        /* ---- B) 答题页本体：已提交 ⇒ 读成绩并写右下角 ----
         *   ⚠️ 加 Set 锁的理由与旧版 log 不同：现在**会写按钮**，
         *      而本函数在主循环里每秒被调用一次 ⇒ 不加锁就是每秒重写。
         *      （按钮文案本身幂等，但 submittedDetailSeen 会被反复重置，
         *        用户点按钮永远看到弹窗、永远进不了暂停 = 入口失效。） */
        const st = readSubmittedState();
        if (!st) return;
        if (submittedStatePaths.has(path)) return;
        submittedStatePaths.add(path);

        const bar = formatSubmittedBar(st);
        const quizId = (path.match(/\/quiz\/(\d+)/) || [])[1] || '';
        log('测验已完成（本页为答题页·已提交形态）：' + bar +
            (quizId ? '；测验编号 ' + quizId : ''));
        /* 【v2.5.19】priority=2：与「需手动」同级 —— 都是「脚本此刻为什么不动作」。
         *   必须 ≥1，否则会被 renderPauseButton 的常态文案 1 秒内盖掉
         *   （本项目踩过两次，见 updatePauseButtonHint 注释）。 */
        updatePauseButtonHint('已完成 · ' + bar + '（点这里看详情）', 2);
        submittedDetail = formatSubmittedDetail(st, quizId);
        submittedDetailSeen = false;
    }

    /* 【v2.5.19】已提交状态只播报一次（主循环每秒一轮，不拦会刷屏并锁死按钮）*/
    const submittedStatePaths = new Set();
    /* 结果页同理（原来靠 log 的「只播一次」语义，现在要写按钮 ⇒ 必须显式加锁）*/
    const resultReportedPaths = new Set();
    /* 「已完成」详情的全文与「看过没」——
     *   与 paperReasonFull / paperReasonSeen 平行：v2.5.17 那套是给**失败**用的，
     *   这一套是给**成功/已完成**用的。两者互不覆盖（不同分支写入）。 */
    let submittedDetail = '';
    let submittedDetailSeen = false;

        /* ============================================================
     *  【v2.3.0 起移除】「一键完成」整节删除。
     *  该功能通过伪造播放记录接口直接标记「本章看完」，实测已失效
     *  （服务端校验变化，提交后进度不更新），且属于伪造学习记录、
     *  风险最高。用户要求删除，故不再保留开关，代码一并移除。
     * ============================================================ */

    /* ============================================================
     *  【v2.3.0 起不再干预播放速度】原「幽灵模式」章节整体移除。
     *  原因：平台对 playbackRate / currentTime 的异常推进都有检测，
     *  维护成本高；用户已改用 Global Speed 扩展自行控制倍速。
     *  本脚本只负责「让视频一直播下去」和「播完自动跳下一章」。
     * ============================================================ */

/* ============================================================
     *  九、视频页处理
     * ============================================================ */

    /* ============================================================
     *  【v2.5.0 新增】需求4：视频「一出现就静音」
     *
     *  用户实测症状：「跳章节跳到视频时，视频会先播放几帧然后才被禁音」
     *
     *  根因：handleVideoPage 由主循环每 1000ms 调一次，
     *  视频元素在两次轮询之间就可能已经 play() 了 ——
     *  那几帧的声音是真的发出来了，事后再设 volume=0 无法撤回。
     *
     *  修法：双保险，把静音时机提前到「元素刚进文档」和「刚开始播放」：
     *    ① MutationObserver 监听 video 元素被插入 DOM 的瞬间
     *    ② 在 video 自己身上监听 play / playing / loadedmetadata / volumechange
     *       —— 其中 volumechange 是关键：平台可能自己把音量调回来
     *  ② 的 play 事件是最后一道闸门：即使 ① 没赶上，
     *  在 play 触发的【同一事件循环】里静音，也不会发出那几帧声音。
     * ============================================================ */
    const muteVideo = (v) => {
        if (!v || !cfg('autoVideo')) return;
        try {
            if (v.volume !== 0) v.volume = 0;
            if (!v.muted) v.muted = true;      // muted 比 volume=0 更彻底、更早生效
        } catch (e) {}
    };

    /* 给一个 video 元素挂上「立刻静音」的监听（幂等，重复调用无害） */
    function armInstantMute(v) {
        if (!v || v.__gxbMuteArmed) return;
        v.__gxbMuteArmed = true;
        muteVideo(v);
        // play 是最关键的一道闸门：与「开始出声」同一时刻
        ['play', 'playing', 'loadedmetadata', 'volumechange', 'canplay'].forEach((ev) => {
            v.addEventListener(ev, () => muteVideo(v), true);   // capture 提前拿到
        });
    }

    /* 扫描当下所有 video/audio 并武装 + 监听未来新增的 */
    function installInstantMute() {
        if (!cfg('autoVideo')) return;
        if (window.__gxbMuteInstalled) return;
        window.__gxbMuteInstalled = true;

        const scan = () => {
            qa('video, audio').forEach(armInstantMute);
        };
        scan();

        // video 往往在播放器初始化后才插入 → 必须监听 DOM 变化
        try {
            const mo = new MutationObserver((muts) => {
                for (const m of muts) {
                    for (const n of m.addedNodes) {
                        if (!n || n.nodeType !== 1) continue;
                        if (n.tagName === 'VIDEO' || n.tagName === 'AUDIO') {
                            armInstantMute(n);
                        } else if (n.querySelectorAll) {
                            n.querySelectorAll('video, audio').forEach(armInstantMute);
                        }
                    }
                }
            });
            // ⚠️ 观察 document.body + subtree：只认「自己及后代」，
            //    不这么写收不到深层节点的插入（本项目踩过这个坑）
            mo.observe(document.body || document.documentElement, {
                childList: true, subtree: true,
            });
        } catch (e) {}
    }

    function handleVideoPage() {
        const video = q('#video_player_html5_api') || q('video');

        // 记录用户是否主动暂停过：一旦用户手动暂停，就不再强行续播。
        // 【v2.3.0】这里改用「显式点击」判定，不再单纯依赖 pause 事件 ——
        // 因为平台失焦时也会派发 pause，那种情况是我们【要对抗】的，
        // 不能把它误当成「用户想暂停」。（原实现会把平台暂停当成用户意图，
        // 于是失焦一次后再也不自动续播，与用户诉求正好相反。）
        if (video && !video.__gxbPauseHooked) {
            video.__gxbPauseHooked = true;
            const markUser = () => { video.__gxbUserPaused = true; };
            // 只有「用户真的在播放器区域内点过」才算主动暂停
            video.addEventListener('click', () => {
                // 点击时若正在播放 → 这次点击会把视频暂停，视为用户意图
                if (!video.paused) markUser();
                else video.__gxbUserPaused = false;
            });
            video.addEventListener('play', () => { video.__gxbUserPaused = false; });
            // 键盘空格也常被用来暂停
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && document.activeElement === video) markUser();
            });
        }
        // 静音 + 自动续播
        // 【v2.5.0】静音改用 muteVideo()（同时设 muted，比只设 volume 更彻底、
        // 且能在 play 事件里抢在出声前生效）。armInstantMute 保证后续不反弹。
        if (video && cfg('autoVideo')) {
            try {
                armInstantMute(video);
                muteVideo(video);
                if (video.paused && !video.__gxbUserPaused && !video.ended) {
                    video.play().catch(() => {});
                }
            } catch (e) {}
        }

        attachQuizObserver();

        // 教师答疑区：抄既有回复提交
        if (cfg('autoTeacherReply')) {
            try {
                if (q('.gxb-icon-teacher') && !q('.quiz-item')) {
                    const reply = q('.reply-content');
                    const body = getEditorBody();
                    if (reply && body && !body.innerText.trim()) {
                        setEditorText(reply.innerText);
                        setTimeout(submitReply, 3000);
                    }
                }
            } catch (e) {}
        }

        // 播完跳下一章：不在这里做。
        // 【v2.4.0】跳章决策已统一收口到主循环的 maybeAdvance（它同样会读
        // 播放器状态、且额外读目录进度），这里再跳一次会和它打架、同一章点两次。
        // 本函数只负责：静音播放、失焦续播、挂答题观察器、答疑区抄答案。
    }

    /* ============================================================
     *  【v2.5.0 新增】需求2：判断「当前章是不是目录里的最后一章」
     *
     *  为什么需要这个：
     *  用户在最后一章（讨论页）遇到【假警报】——
     *  「本页讨论未提交（返回内容为空）」，脚本停下等配置。
     *  但这一页之所以「没有内容可提交」，可能正是因为它已经是最后一章，
     *  或者这页本来就不需要回复。
     *
     *  根因：原实现只问「本章完成了吗」（readChapterProgress），
     *  从不问「还有下一章吗」。最后一章被当成「卡住的中间章」处理。
     *
     *  修法：先问「有没有下一章」——
     *    - 没有下一章 → 说明整门课已到末尾 → 宣告刷完并停止
     *    - 有下一章  → 才走原来的「卡住等人工」逻辑
     *
     *  返回：
     *    { isLast: true,  total, index }  ← 已是最后一章
     *    { isLast: false, total, index }  ← 后面还有
     *    null                             ← 认不出目录（不做任何断言，降级）
     *
     *  ⚠️⚠️ 【v2.5.1 修正】不能用 visible() 判断「后面还有没有章节」
     * ------------------------------------------------------------
     *  用户实测反馈：「只刷完一个章节就停下了，应该刷完所有章节再停下」。
     *
     *  根因：原来 hasNext 要求 `a.chapter-info` 必须 visible（offsetParent !== null）。
     *  但真实目录是【可折叠的三级结构】，每个 Chapter 下面是可折叠的
     *  ul.gxb-show（带 `gxb-icon-toggle toggle-chapter` 折叠按钮）：
     *
     *      div.unit-list            ← Chapter 级（h4 有 student-unit-status）
     *        └ div.unit-list.item-list-dis   ← 小节级（h4 有 student-item-status）
     *            └ ul.gxb-show              ← 可折叠！折叠时 style="display: none"
     *                └ li.lxy-chapter-li    ← 真正的可点章节
     *
     *  页面默认只展开【当前所在】的那个 unit，其余全部折叠。
     *  于是当前章之后的所有章节都 visible=false
     *  → hasNext 误判为 false → isLast 误判为 true → 刚刷完第一章就宣告「全部刷完」。
     *
     *  实测复现（3 章、后两个在折叠 unit 里）：
     *      「🎉 全部章节已刷完！课程进度：第 1 / 3 章」
     *  ——它自己都知道有 3 章，却说是最后一章。
     *
     *  修法：折叠是【UI 状态】，不是【课程是否还有内容】的判据。
     *  改为只认「结构上还有没有下一个条目」，并且只把真正
     *  【锁住 / 未解锁】的章节排除 —— 那才是点不进去的。
     * ============================================================ */
    function checkIsLastChapter() {
        const items = chapterItems();
        if (!items.length) return null;          // 没有目录信息 → 降级
        const cur = currentNodeItem();
        if (!cur) return null;                   // 认不出当前章 → 降级
        const curIdx = items.indexOf(cur);
        if (curIdx < 0) return null;             // 当前章不在条目序列里 → 降级

        // 「最后一章」的判据：当前章之后还有没有【能刷的】章节。
        //
        // ⚠️ 【v2.5.1】这里【不能】再用 visible()：
        //    真实目录每个 unit 都是可折叠的（ul.gxb-show + toggle-chapter），
        //    页面默认只展开当前 unit，后面全部 display:none。
        //    用 visible 判会把「折叠」误当成「没有下一章」
        //    → 刚刷完第一章就宣告全刷完（用户实测反馈的问题）。
        //
        // 也不能只看 curIdx === items.length - 1：
        //    目录里可能有【锁住未解锁】的章节排在后面，那些才真的点不进去。
        //    「能刷的都刷完了」才是结束 —— 所以只排除锁住的，不排除折叠的。
        let hasNext = false;
        for (let i = curIdx + 1; i < items.length; i++) {
            const a = items[i].querySelector('a.chapter-info');
            if (!a) continue;                 // 没有可点链接的条目（纯标题行）→ 跳过
            if (isItemLocked(items[i])) continue;   // 锁住的 → 点不进去，不算「还有」
            hasNext = true;
            break;
        }

        return {
            isLast: !hasNext,
            total: items.length,
            index: curIdx,
            next: hasNext,
        };
    }

    /* ============================================================
     *  【v2.4.0 核心】统一完成判定 —— 所有页面类型走同一个入口
     *
     * 原实现每种类型各写一套判据（视频读播放器、doc 死等 12 秒、
     * 讨论页提交完才跳、测验页直接 return 不跳），行为不一致且都有卡死路径。
     *
     * 现在统一为：
     *   ① 先读【目录进度】（最权威，平台自己的记录）
     *   ② 读不到再按类型降级（视频读播放器 / 音频读播放器 / 其他给时间窗）
     *
     * 返回 { settled: boolean, reason: string }
     * ============================================================ */
    /* ============================================================
     *  【v2.5.0 新增】需求3：「直接就跳」的页面类型判定
     *
     *  用户原话：「跳章节遇到除视频和讨论外的章节（作业，考试）都直接跳」
     *  → video / audio 要播完再跳，topic 要回复完再跳，
     *    作业 / 考试 / 认不出的 → 一律【立刻】跳，不等宽限期。
     *
     *  ⚠️ 为什么 doc 不在这里「立刻跳」：
     *     用户在更早一轮明确说过「文档页只要打开就算看完，检测目录那边的
     *     进度有没有」。也就是说文档页的正确语义是【两级】：
     *       ① 目录已经标了本章完成 → 立刻跳（由 isChapterSettled 的目录分支给出）
     *       ② 目录读不到进度 → 等 docGraceMs 宽限，再跳
     *     如果把 doc 也塞进「立刻跳」，第 ② 级就永远走不到，
     *     docGraceMs / 「无进度信号，等时间窗」整段会变成死代码 ——
     *     而且会出现「文档还没看完就被秒跳」的副作用。
     *     本函数返回 true 时 maybeAdvance 会直接 return，不再看 settled，
     *     因此这里必须只圈「真的没什么可做」的类型。
     *
     *  ⚠️ 受「非视频章节自动跳过」(skipNonVideo) 总开关约束：
     *     用户关掉它时不该仍然强跳 —— 那会违背开关语义。
     * ============================================================ */
    function isSkipInstantlyKind(kind) {
        if (!cfg('skipNonVideo')) return false;   // 总开关关了 → 不跳
        if (kind === PAGE_KIND.video) return false;   // 视频要看完
        if (kind === PAGE_KIND.audio) return false;   // 音频同理
        if (kind === PAGE_KIND.topic) return false;   // 讨论要回复
        if (kind === PAGE_KIND.doc) return false;     // 文档走「目录进度 + 时间窗」两级
        /* 【v2.5.8】测验 / 作业章：用户选「先答完再跳」时不再立刻跳 ——
         *   交给 maybeAdvance 的「情况 C」宽限窗口等答题，交卷后由情况 A 跳走。
         *   默认 'skip' 时行为与 v2.5.0 起完全一致（立刻跳）。 */
        if (kind === PAGE_KIND.quiz && cfg('quizChapterMode') === 'answer') return false;
        return true;   // 作业 / 考试 / 认不出的 → 立刻跳
    }

    /* ============================================================
     *  【v2.5.2 新增】目录里的「章节完成度」三态
     *
     *  一开始我以为目录里视频只有二值状态（完成 / 没完成），
     *  后来拿到用户第 3 份真实目录快照（当前章 = 作业 5598946）才发现是【三态】：
     *
     *    <i class="gxb-icon-begin student-chapter-status gxb-icon-end"></i>  ← 已完成
     *    <i class="gxb-icon-begin student-chapter-status gxb-icon-ing"></i>  ← 进行中（看了一部分！）
     *    <i class="gxb-icon-begin student-chapter-status"></i>                ← 完全没开始
     *
     *  ⚠️ 这一条是「视频没播完就跳」的**目录侧根因**：
     *    旧逻辑只问「有没有 gxb-icon-end」，看到 ing（看了一半）就当成
     *    「没完成 → 不跳」……?? 不对 —— 真实流程是反过来的：
     *    旧逻辑在媒体分支里根本没机会跑（目录先 return 了），
     *    而目录一旦是 end（历史会话看完过）就直接授权跳过。
     *
     *    现在配合媒体分支（readMediaProgress）做双保险：
     *      · 目录说 end  ≠ 本次播完了 → 不能授权跳过
     *      · 目录说 ing  = 明确「看了一部分」→ 宁可多等，也不能跳过
     *    ing 这个状态是平台自己的「进度已存在但未满」的记录，
     *    它比 end 更能说明「这一章还没刷透」。
     * ============================================================ */
    // 目录完成度：'done' | 'doing' | 'none' | null(读不到)
    function readCatalogState() {
        const cur = currentNodeItem();
        if (!cur) return null;
        const icon = chapterStatusIcon(cur);
        if (!icon) return null;
        const cls = String(icon.className || '');
        if (cls.includes(STATUS_DONE)) return 'done';
        if (cls.includes(STATUS_DOING)) return 'doing';
        return 'none';
    }

    /* ============================================================
     *  【v2.5.2 新增】读「视频/音频这一章的播放进度」
     *
     *  用户诉求（原话）：
     *    「视频没播放完就跳了，跳视频前从目录检查视频进度」
     *    「视频播放器的下方也会显示视频的进度」
     *
     *  两个进度来源，各有各的用处：
     *
     *  ① 播放器下方【平台自绘的进度条】`.video-percent`
     *     —— 这是平台自己记录并上报的进度，**最权威**。
     *     取证：用户此前的两份原始脚本都读的就是它
     *       · yuanYue v0.5 ：  document.getElementsByClassName("video-percent")[0].innerText
     *                          if (videoPercent == 100) next.click()
     *       · PY-DNG v0.9  ：  document.querySelector('.video-percent')
     *                          videoPercent.innerText === '100' && next.click()
     *     两处都拿它当「视频是否看完」的**唯一判据**，值为 '100'。
     *     （以上是原始脚本的**取证记录**，保留原样；本版维护：Thejiuyi）
     *
     *  ② `<video>.ended` / `currentTime vs duration` —— 本地播放器事实。
     *     优点：秒级实时；缺点：平台按心跳记进度，可能比本地落后。
     *
     *  目录里那条「已完成」为什么不能单独用：
     *     它是【历史会话】的记录（以前看完过），
     *     回答不了「这一次播到哪了」——所以不能拿它授权跳过。
     * ============================================================ */
    // 平台自绘的进度条元素（真实类名来自两份原始脚本）
    const MEDIA_PERCENT_SELECTORS = [
        '.video-percent', '.audio-percent',
        '.videoPercent', '.player-percent',
        '[class*="video-percent"]', '[class*="audio-percent"]',
    ];

    /* 【v2.5.3 新增·防御性】排除「落在章节目录里」的进度条候选
     *
     * ⚠️ 先说清楚这条的性质：**这是防御，不是已证实的 bug。**
     *    实测过两份完整目录快照（各 82 章），
     *    `grep -c 'video-percent' 真实目录-*.txt` 命中 **0** ——
     *    真实目录里根本没有进度条元素，进度是用图标（gxb-icon-*）表示的。
     *    两份原始脚本用 `document.querySelector('.video-percent')` 也一直正常。
     *    所以「读错进度条」只是**假设**，不是本次 88% 跳章的根因
     *    （根因是 maybeAdvance 的情况 D，见下面的「情况 D-」）。
     *
     * 为什么仍然留着这道防御：
     *    原实现取的是**文档里第一个** `.video-percent`。
     *    哪天平台在目录条目上加一条进度显示，脚本就会拿别的章节的数字
     *    去判断当前章 —— 属于「静默、且后果是抢跳」的一类。
     *    加 6 行换掉这个隐患是划算的。
     *
     * ⚠️ 另一条更容易犯的错：**别把目录里的 `statusTxt`「进行中」也当进度信号。**
     *    实测那 40 处「进行中」恰好 = 6 作业 + 18 测验 + 16 讨论，
     *    它表示的是**提交状态**，和视频观看进度是两码事。
     *    真拿它挡跳章 → 所有作业/测验/讨论章节都跳不动，直接违背需求 3。
     *    （我差点就这么改了，查了夹具才发现。）
     *
     * 判据用的是**已经验证过的结构事实**（不新造类名）：
     *   #chapterUnit / .chapter-unit-container 是目录容器；
     *   .unit-list 是目录的单元列表；li.lxy-chapter-li 是章条目（实测 82 个）。
     *
     * ⚠️ 我第一版写的是「给候选打分再排序取最优」，变异测试把排序改成
     *    恒等排序后**全部断言仍然全绿** —— 排序是死代码，已删。
     *    **存活下来的变异体就是「这段代码没用」的直接证据**，别删掉了事。
     */
    function isCatalogOwnedPercent(el) {
        try {
            return !!(el.closest('#chapterUnit') ||
                el.closest('.chapter-unit-container') ||
                el.closest('.unit-list') ||
                el.closest('li.lxy-chapter-li'));
        } catch (e) { return false; }
    }

    /** 读平台进度条的数值（去 % 号）；读不到返回 null */
    function readPercentText() {
        const seen = new Set();          // 多个选择器会重复命中同一个元素
        for (const sel of MEDIA_PERCENT_SELECTORS) {
            for (const el of qa(sel)) {
                if (seen.has(el)) continue;
                seen.add(el);
                const raw = (el.innerText || el.textContent || '').trim();
                if (!raw) continue;                 // 元素在但没内容 → 跳过
                const n = parseFloat(raw.replace('%', '').trim());
                if (!isFinite(n)) continue;
                /* 落在章节目录里 → 那是【章条目的进度】，不是【当前播放器的进度】。
                 * 直接丢弃，不参与判定：
                 *   · 拿它授权跳过 = 又回到「拿历史记录授权跳章」的老 bug；
                 *   · 丢弃后 readMediaProgress 会退到播放器自身
                 *     （ended / currentTime），那才是本地事实；
                 *   · 全被丢弃 → 返回 null → 也不会误判成「播完了」。
                 * 宁可降级，也不猜。 */
                if (isCatalogOwnedPercent(el)) continue;
                return { n, raw, sel };
            }
        }
        return null;
    }

    /**
     * 判断「这一章的媒体播完了没有」。
     *
     * 判定顺序（先权威后本地）：
     *   ⓪ 目录说「进行中」(gxb-icon-ing) → **未完成**（平台自己记的"看了一半"，直接否决）
     *   ① 平台进度条 = 100        → 完成（平台自己的记录，最可信）
     *   ② 平台进度条 < 100        → **未完成**（明确数字，且能一票否决本地播放器）
     *   ③ 播放器 ended === true   → 完成（真事件，比 currentTime 可信）
     *   ④ currentTime：贴片尾      → 完成（容差 0.5s）
     *   ⑤ currentTime：没到片尾    → 未完成
     *   ⑥ 连进度条都读不到 / 没有播放器 → 未完成（宁可多等）
     *
     * ⚠️【v2.5.2 关键修正】原来我把「currentTime 到片尾」排在「平台进度条」之前，
     *    结果被这个用例抓出来了：
     *      平台进度条 = 98，但 currentTime 被拖到 599.8/600
     *      → 旧顺序判「到片尾了，完成」→ 跳章，平台的 98 完全被无视。
     *    这正是用户抱怨的「视频没播放完就跳了」——
     *    currentTime 是可以被拖动伪造的，**不能用来推翻平台的记录**。
     *    所以平台进度条必须比 currentTime 更靠前，能一票否决它。
     *    （但平台进度条【不能】否决 ended：ended 是真事件，
     *      而进度条只是定时上报，会滞后于真实播完。）
     *
     * 返回 { done, reason, cur, dur, percent, catalog }
     */
    function readMediaProgress(media) {
        const m = media || findMedia();
        const cur = m ? (Number(m.currentTime) || 0) : 0;
        const dur = m ? Number(m.duration) : NaN;
        const hasDur = !!dur && isFinite(dur) && dur > 0;
        const localPercent = hasDur ? (cur / dur) * 100 : -1;

        const pct = readPercentText();   // 平台自绘进度
        const catalog = readCatalogState();   // 目录三态

        // ⓪ 目录说「进行中」= 平台记着「看过一部分但没满」
        //    → 这是一条明确的"没刷透"信号，优先级高于一切
        if (catalog === 'doing') {
            return {
                done: false,
                reason: '目录显示「进行中」（未刷完）',
                cur, dur, percent: pct ? pct.n : localPercent, catalog,
            };
        }

        // ① 平台说 100% → 完成（最高优先，它不是推测而是平台记录）
        if (pct && pct.n >= 100) {
            return { done: true, reason: '平台进度条 ' + pct.raw, cur, dur, percent: pct.n, catalog };
        }
        // ② 平台给了明确的小于 100 的数字 → 未完成，且【一票否决】本地 currentTime
        if (pct) {
            return {
                done: false,
                reason:
                    '平台进度条 ' + pct.raw +
                    '（未到 100，本地进度 ' + (hasDur ? localPercent.toFixed(1) + '%' : '未知') + ' 不予采信）' +
                    (m && m.paused ? '（播放器暂停中）' : ''),
                cur, dur, percent: pct.n, catalog,
            };
        }
        // ③ 播放器自己说结束了（真事件，优先于 currentTime 数值）
        if (m && m.ended) {
            return { done: true, reason: '播放器已 ended', cur, dur, percent: localPercent, catalog };
        }
        // ④ 播放游标已经贴到片尾（没有平台进度条时的凭据）
        if (hasDur && cur > dur - 0.5) {
            return {
                done: true,
                reason: '播放进度到片尾 ' + cur.toFixed(1) + '/' + dur.toFixed(1),
                cur, dur, percent: localPercent, catalog,
            };
        }
        // ⑤ 什么进度都读不到
        if (!m) {
            return { done: false, reason: '页面上找不到播放器', cur, dur, percent: -1, catalog };
        }
        return {
            done: false,
            reason: hasDur
                ? ('本地播放进度 ' + localPercent.toFixed(1) + '%' + (m.paused ? '（已暂停）' : ''))
                : '播放器还没拿到时长',
            cur, dur, percent: localPercent, catalog,
        };
    }

    function isChapterSettled(kind) {
        /* ---- ① 【v2.5.2】视频 / 音频先看播放器与平台进度，目录只作参考 ----
         * 顺序很重要：v2.5.1 之前是「目录说完成就跳」，直接 return，
         * 播放器根本没机会说话 —— 于是没播的视频也被跳过了。
         * 现在媒体类型【必须】由进度确认播完。
         * ------------------------------------------------------ */
        if (kind === PAGE_KIND.video || kind === PAGE_KIND.audio) {
            const mp = readMediaProgress();
            if (mp.done) {
                return { settled: true, reason: kind + ' ' + mp.reason };
            }
            // 进度说没播完 → 一律不跳（哪怕目录标着已完成）
            return { settled: false, reason: kind + ' ' + mp.reason };
        }

        // ---- ② 【v2.5.2】非媒体章节也要排除「进行中」----
        //   目录说 gxb-icon-ing = 平台记着「看了一半」，
        //   对 doc/quiz 这类没有播放器的页面，这就是唯一可用的进度信号，
        //   绝不能因为「不是 end」就当成「没做完可以跳」。
        const catalog = readCatalogState();
        if (catalog === 'doing') {
            return { settled: false, reason: '目录显示「进行中」（未刷完）' };
        }

        // ---- ③ 其他类型：目录进度优先（对 doc/quiz/topic 都是有效信号）----
        const byCatalog = readChapterProgress();
        if (byCatalog === true) return { settled: true, reason: '目录显示本章已完成' };

        // ---- ④ 按类型降级 ----
        if (kind === PAGE_KIND.quiz) {
            // 测验页：交卷成功由 answerQuizIfPresent 记进 quizSubmittedPaths，
            //        再由 handleQuizPageGating 置起 quizSubmittedHere（不是 quizDone，
            //        quizDone 是 WeakSet，只用于防重复提交，不能当"这一章过了"的信号）
            if (quizSubmittedHere) return { settled: true, reason: '本章测验已交卷' };
            return { settled: false, reason: '测验尚未交卷' };
        }

        if (kind === PAGE_KIND.topic) {
            if (topicState === 'done') return { settled: true, reason: topicDoneReason };
            if (topicState === 'failed') return { settled: false, reason: '讨论未提交（已停等人工处理）' };
            return { settled: false, reason: '讨论未提交（处理中）' };
        }

        // doc：目录读不到本章完成 → 用时间窗兜底（docGraceMs）
        //   ⚠️ unknown 不会走到这里 —— isSkipInstantlyKind 已把它划入「立刻跳」，
        //      maybeAdvance 在那之前就 return 了。保留此 return 是为了 doc。
        return { settled: false, reason: '无进度信号，等时间窗' };
    }

    /* 【v2.4.0】原 isChapterFinished(video, percentEl) 已删除。
     * 它的三条判据（percent>=100 / ended / currentTime 近片尾）已全部并入
     * isChapterSettled 的媒体分支，保留两份会让人误以为有两套判据。
     * 判定入口现在只有 isChapterSettled 一个。
     */

    /* ============================================================
     *  十、设置菜单
     * ============================================================ */

    function ask(label, key, secret) {
        const v = prompt(label, secret ? '' : cfg(key));
        if (v !== null && v.trim() !== '') GM_setValue(key, v.trim());
    }

    function toggle(key, label) {
        const next = !cfg(key);
        GM_setValue(key, next);
        alert(label + '已' + (next ? '开启' : '关闭') + '\n刷新页面生效');
    }

    /* 【v2.5.8】测验 / 作业章节：跳过 ↔ 先答完再跳。
     * 不是简单的开/关，所以单独写一个（面板「设置」）。 */
    function toggleQuizChapterMode() {
        const next = cfg('quizChapterMode') === 'answer' ? 'skip' : 'answer';
        if (next === 'answer' && !cfg('autoQuiz')) {
            /* 「先答完再跳」靠答题链路干活。答题关着的话，测验章会一直等到
             * grace*3 超时才跳 —— 用户会以为卡住了，所以先问一句。 */
            if (confirm(
                '提示：面板「设置」「自动答题」当前是关闭的。\n\n' +
                '「先答完再跳」需要答题功能配合，否则测验 / 作业章会一直等到超时才跳。\n\n' +
                '要顺便打开「自动答题」吗？'
            )) {
                GM_setValue('autoQuiz', true);
            }
        }
        GM_setValue('quizChapterMode', next);
        alert(
            '测验 / 作业章节处理方式已改为：' + (next === 'answer' ? '先答完再跳' : '跳过') +
            '\n刷新页面生效。'
        );
    }

    /* 【v2.5.5】选服务商预设 */
    function chooseApiPreset() {
        const lines = API_PRESETS.map((p, i) => (i + 1) + '. ' + p.name);
        const ans = prompt(
            '选择 AI 服务商（输入序号）：\n\n' + lines.join('\n') +
            '\n\n当前：' + (cfg('apiPreset') || '(未选)') +
            '\n\n选完会自动填好「地址 + 模型名」，你只需要再填 API Key（面板「设置」）。\n' +
            '⚠️ 各平台的地址和模型名会变。选完建议用面板「设置」「测试 AI 连接」验一下。'
        );
        if (ans === null) return;
        const i = parseInt(String(ans).trim(), 10) - 1;
        if (!(i >= 0 && i < API_PRESETS.length)) { alert('序号不对，没有做任何修改。'); return; }
        const p = API_PRESETS[i];
        GM_setValue('apiPreset', p.id);
        GM_setValue('apiUrl', p.url);
        if (p.model) GM_setValue('model', p.model);
        alert('已选择「' + p.name + '」\n\n' +
            '地址：' + (p.url || '(留空，请手动填)') + '\n' +
            '模型：' + (p.model || '(留空，请手动填)') + '\n\n' +
            '还需要填 API Key（面板「设置」）。填完建议用面板「设置」 测一下。');
    }

    /* 【v2.5.16】「短测试」证明不了「整卷能过」—— 这里造一份【按整卷形状】的探针请求。
     *
     * 用户实测（2026-09-21）：面板「设置」 测试连接 ✅ 通过，
     * 但 100003 自动作答报「AI 调用失败：返回内容为空」。
     * 复现证明（browser-demo/probe-ai-empty-vs-test.mjs）：
     *   测试连接 = '只回复两个字：收到'（9 字符）→ 推理模型思考几十 token 就完，额度够；
     *   整卷测验 = 整卷题面（上千字符）+ 强制 JSON → 思考量暴涨，500/2000/6000 全被吃光。
     * ⇒「测试通过」只证明**短问题**能过，**不能**证明整卷能过。
     *
     * 所以这里用**和整卷一样的形状**再测一次：同样长的 user 内容、
     * 同样的「只输出 JSON」要求、同样的 system 尾巴。这才是那条会失败的路径。 */
    function buildQuizProbePrompt() {
        /* 用真实长度的假题面 —— 重点是长度与「要 JSON」，不是题目内容本身。
         * 取 3 题、每题 4 个选项，逼近真机整卷（实测 100003 是 5 题）。 */
        const L = [];
        L.push('下面是一份在线测验的完整题目。请逐题作答，只输出一个 JSON 对象，不要任何解释、不要 markdown 代码块。');
        L.push('');
        L.push('输出格式（严格照抄这个结构）：');
        L.push('{"answers":[{"question_id":"900001","answer_ids":["800001"]}]}');
        L.push('');
        L.push('规则：');
        L.push('- answer_ids 必须是数组；单选/判断只放 1 个 id，多选放多个 id。');
        L.push('- id 必须从下面题目给出的「选项 id」里原样抄，不得编造、不得改写。');
        L.push('- 每题都必须给答案，不许留空、不许写"不确定"。');
        L.push('');
        L.push('题目：');
        for (let i = 1; i <= 3; i++) {
            L.push('');
            L.push('[单选] question_id=' + (900000 + i));
            L.push('第 ' + i + ' 题：以下关于人工智能的说法，哪一项是正确的？（这是连通性测试用的占位题面，' +
                '请照常作答，不要因为它没意义就拒绝输出 JSON。）');
            for (let k = 0; k < 4; k++) {
                L.push('  ' + String.fromCharCode(65 + k) + '. (id=' + (700000 + i * 10 + k) +
                    ') 选项 ' + String.fromCharCode(65 + k) + ' 的占位文本，用于把请求长度做得和真实整卷接近。');
            }
        }
        return L.join('\n');
    }

    /* 和 handleWholePaperQuiz 里那句 extraSystem **逐字一致**（别让两处写法漂移）*/
    const QUIZ_EXTRA_SYSTEM =
        '\n\n你正在做一份计分测验，答错会扣分且机会有限。' +
        '请务必认真作答，宁可根据常识和语言理解推理，也不要空着。' +
        '只输出要求的 JSON，不要任何其他文字。';

    /* 【v2.5.5 起】测试 AI 连接：真发一次请求，把结果直接告诉用户。
     * 为什么需要它：预设里的地址/模型名会过时，光看配置看不出来。
     * 真发一次，服务商的报错会原样带回来，比任何文档都准。
     *
     * 【v2.5.16】改成**两步**：短问题 + 按整卷形状的长问题。
     *   只测短问题会给出**误导性的通过** —— 用户拿着「连接成功」去自动做测验，
     *   却卡在「返回内容为空」，完全不知道为什么。 */
    async function testApiConnection(sink) {
        /* 【v2.5.22】sink 是可选的「输出口」：
         *   面板调用时传 { say(text) } —— 把结果写进面板（用户不开 F12，
         *   也不该被 alert 打断）；不传时仍用 alert（菜单入口 / 旧行为）。
         * ⚠️ 必须做**类型判断**：菜单回调会把 event 当第一个参数传进来，
         *   不能直接 `sink.say(...)`。 */
        const say = (sink && typeof sink.say === 'function') ? sink.say : (m) => alert(m);

        if (!cfg('apiUrl') || !cfg('apiKey')) {
            say('还没配好：地址或 Key 是空的。\n在面板「设置」里选服务商、填 API Key。');
            return;
        }
        const model = cfg('model');
        console.log('[高校邦助手] 测试 AI 连接… 地址=' + cfg('apiUrl') + '  模型=' + model);
        console.log('[高校邦助手] 第 1 步：短问题（验证地址/Key/模型名通不通）…');

        /* ---- 第 1 步：短问题（原来的测试，原样保留）---- */
        let shortOk = null;
        try {
            shortOk = await callAI('只回复两个字：收到');
            console.log('[高校邦助手] 第 1 步成功，返回：' + shortOk);
        } catch (e) {
            console.error('[高校邦助手] 第 1 步失败：' + e.message);
            say('❌ 连接失败（连最短的请求都没通）\n\n' + e.message + '\n\n' +
                '常见原因（按报错内容对号入座）：\n' +
                '· 401 / 403 → Key 填错、或账户没余额\n' +
                '· 404 / model not found → 模型名不对（去服务商控制台复制当前可用的模型 ID）\n' +
                '· 404 / 响应不是合法 JSON → 地址不对（要填到 /chat/completions 为止；\n' +
                '  别填「流式」端点）\n\n' +
                '详情看浏览器控制台（F12）。');
            return;
        }

        /* ---- 第 2 步：按【整卷测验的真实形状】再测一次 ----
         * 这一步才是自动做测验时真正走的那条路径。 */
        console.log('[高校邦助手] 第 2 步：长问题 + 强制 JSON（模拟整卷测验的真实形状）…');
        const probe = buildQuizProbePrompt();
        console.log('[高校邦助手] 探针 prompt 长度 = ' + probe.length +
            ' 字符（真实整卷通常 1000~4000 字符）');
        try {
            const r = await callAI(probe, QUIZ_EXTRA_SYSTEM);
            console.log('[高校邦助手] 第 2 步成功，返回前 120 字：' + String(r).slice(0, 120));
            say('✅ 全部通过\n\n模型：' + model +
                '\n第 1 步（短问题）：' + String(shortOk).slice(0, 40) +
                '\n第 2 步（按整卷形状，' + probe.length + ' 字符）：✅ 也拿到了正文\n\n' +
                '这个模型可以用来自动做测验。');
        } catch (e) {
            const msg = String(e && e.message ? e.message : e);
            console.error('[高校邦助手] 第 2 步失败：' + msg);
            /* 区分「额度不够」与「纯格式问题」—— 两种给的动作不同 */
            const isBudget = /max_tokens|推理模型|reasoning_content|返回内容为空/.test(msg);
            say('⚠️ 半通：短问题通了，但【按整卷形状的请求】失败\n\n' +
                '第 1 步（短问题）：✅ ' + String(shortOk).slice(0, 40) + '\n' +
                '第 2 步（' + probe.length + ' 字符 + 强制 JSON）：❌\n\n' +
                '失败详情：\n' + msg + '\n\n' +
                (isBudget
                    ? '⚠️ 这【不是】连接问题 —— 地址和 Key 都是好的。\n' +
                      '原因是：问题一变长，模型（多半是【推理模型】）的「思考」就变多，\n' +
                      '把 max_tokens 额度吃光了，于是正文是空的。\n' +
                      '短问题思考少、额度够，所以第 1 步才会通过。\n\n' +
                      '✅ 怎么办（按省事程度）：\n' +
                      '① 在面板「设置」里把模型名换成一个【非推理模型】：\n' +
                      '   deepseek-chat / qwen-plus / glm-4-flash 这类；\n' +
                      '② 换一个额度更宽松的模型档位（如 qwen-max、glm-4-plus）。\n' +
                      '⚠️ 只要不换模型，自动做测验就会一直停在这一步（脚本不会拿残缺答案凑合交卷）。'
                    : '这不是「额度不够」的表现，请按详情里的原文排查：\n' +
                      '· 响应不是合法 JSON → 地址要填到 /chat/completions，别用「流式」端点\n' +
                      '· 报错提到 JSON / 格式 → 该模型不擅长按 JSON 作答，换一个模型\n' +
                      '详情看浏览器控制台（F12）。'));
        }
    }

    /* 【v2.5.5】选讨论题处理方式 */
    function chooseTopicMode() {
        const CN = {
            skip: '跳过（不提交任何内容，直接过）',
            copy: '抄答案（抄讨论区里已有的一条同学回复）',
            api: '接入 API（AI 生成）',
        };
        const ans = prompt(
            '讨论题处理方式（输入序号）：\n\n' +
            '1. ' + CN.skip + '\n' +
            '2. ' + CN.copy + '\n' +
            '3. ' + CN.api + '\n\n' +
            '当前：' + (CN[cfg('topicMode')] || cfg('topicMode')) + '\n\n' +
            '⚠️ 三种方式【互不兜底】：选「抄答案」时若页面上没有可抄的回复，' +
            '会不提交任何内容、在页面上报错、然后跳过本章。'
        );
        if (ans === null) return;
        const m = { '1': 'skip', '2': 'copy', '3': 'api' }[String(ans).trim()];
        if (!m) { alert('序号不对，没有做任何修改。'); return; }
        GM_setValue('topicMode', m);
        alert('已设为：' + CN[m] + '\n（刷新页面生效）');
    }

    /* ============================================================
     *  【v2.5.22】菜单只剩「面板相关」的 3 条
     *
     *  用户要求：「把配置相关的功能都做到新的 ui 里，原本配置的地方只保留控制面板相关」。
     *  ⇒ 原来 ①~⑯ 的配置项全部搬进面板的「设置」视图（见 TOPBAR_SETTINGS）。
     *
     *  ⚠️ ② 绝对不能省：面板可以在设置里被隐藏，若菜单里没有恢复入口，
     *     用户就**再也打不开了**（「不能把用户锁在外面」）。
     *
     *  ⚠️ 为什么要「打开设置面板」这一条：
     *     面板默认显示、点标题栏的「设置」就进去了，日常用不到菜单。
     *     但面板被关掉 / 最小化 / 拖到屏幕边缘时，这条是最省事的找回方式。
     * ============================================================ */
    GM_registerMenuCommand('① 打开设置面板（顶部）', () => {
        /* 确保面板显示 + 切到设置视图 */
        if (!cfg('showTopBar')) GM_setValue('showTopBar', true);
        renderTopBar();
        setTopBarView('settings');
    });
    GM_registerMenuCommand('② 顶部控制面板：显示 / 隐藏', () => {
        GM_setValue('showTopBar', !cfg('showTopBar'));
        const on = cfg('showTopBar');
        renderTopBar();
        if (on) setTopBarView('status');
        alert('顶部控制面板已' + (on ? '显示' : '隐藏') + '\n（已立即生效，不用刷新）');
    });
    GM_registerMenuCommand('③ 重置顶部面板位置（拖乱了用这个）', () => {
        GM_setValue('uiTopBarPos', '');
        topBarPos = null;
        if (topBarEl) applyTopBarPos(null, true);
        alert('顶部面板已回到【顶部居中】位置。');
    });

    /* 【v2.5.22】下面这些函数**保留** —— 面板的「设置」视图在调用它们
     *（chooseApiPreset / ask / toggle / toggleQuizChapterMode / chooseTopicMode
     *  现在没有菜单入口，但函数本身还在用；testApiConnection 由面板按钮调用）。
     * ⚠️ 不删的理由：删了会让面板的设置项失效；而且旧入口的历史行为
     *   在 test-v2516 里还有断言（已改为从面板触发）。 */
    void chooseApiPreset; void ask; void toggle; void toggleQuizChapterMode; void chooseTopicMode;

    /* 【v2.5.22】①~⑯ 的菜单注册已移除 —— 配置全部搬进面板的「设置」视图。 */

    /* 【v2.5.22】⑰/⑱ 的旧注册已并入上面的 ②/③。 */

    /* ============================================================
     *  十一、主循环
     * ============================================================ */

    // 每个路径的「首次进入时间」和「最后一次跳章尝试时间」，跳章决策用的两个状态。
    // 【v2.4.0】原 NONVIDEO_GRACE_MS 常量与 handleNonVideoPage 已被 maybeAdvance 取代
    // （宽限期改为可配置的 cfg('docGraceMs')），整段删除，避免两套逻辑并存打架。
    const pageEnteredAt = new Map();
    let lastPath = location.pathname;

    /* ============================================================
     *  十二、【v2.5.4】运行环境自检
     *
     *  用户报「视频在 88% 就被跳章」，查下来有三层：
     *    ① 判定顺序错（v2.5.2 修）
     *    ② 时间窗兜底没堵（v2.5.3 修）
     *    ③ ⭐ 篡改猴里囤了 12 个历史版本，旧版 v2.5.2 仍启用 ← 这层让①②看起来「无效」
     *  实测同一秒两行日志：
     *    [v2.5.3] 本页（video）媒体未播完，已停止自动跳章
     *    [v2.5.2] 本章无进度信号（video），停留 13s 后跳过
     *  新版守规矩了，旧版照跳不误 —— 用户看到的现象还是「被跳章」。
     *
     *  第③层代码侧无法根治（旧版不受我们控制），但可以**立刻暴露出来**：
     *  把「页面上跑了几份助手」「这一次跳章是谁发起的」变成页面上可见的告警，
     *  用户就能一眼知道该去删版本，而不是继续怀疑脚本。
     *
     *  两条互补的检测，覆盖面不同，都要留着：
     *    ① checkMultiInstance  —— 数同名 UI 元素。覆盖 v2.4.0 及以上
     *       （更早的版本不创建任何 DOM，数不到，所以必须有 ②）。
     *    ② checkNavAttribution —— 跨页面交接，与版本无关，任何脚本抢跳都能抓到。
     * ============================================================ */

    /* 本脚本会创建的 UI 元素 id（v2.4.0 起沿用同一套 id）。
     * 同名 id 重复出现时 querySelectorAll('#id') 会把【全部】都返回，
     * 所以数出来的个数就是「页面上有几份助手」。 */
    const SELF_UI_IDS = ['gxb-helper-pause', 'gxb-helper-hint', 'gxb-helper-done'];
    let multiInstanceWarned = false;

    function countRunningInstances() {
        let n = 0;
        for (const id of SELF_UI_IDS) {
            const c = document.querySelectorAll('#' + id).length;
            if (c > n) n = c;
        }
        return n;
    }

    /* 自检专用的告警条。
     *
     * ⚠️ 刻意【不复用】showStuckHint，两个原因：
     *   ① showStuckHint 被 cfg('topicStuckHint') 守着 —— 用户一关「讨论页卡住提示」，
     *      多版本告警就在页面上消失了。开关控制「做不做」，不该控制「说不说」。
     *   ② showStuckHint 同一时刻只留一条（已存在就直接 return）——
     *      自检告警会被「本页视频未播完」这类业务提示挤掉，或者反过来挤掉它。
     *
     * 消息按【种类】占位，同种类的新消息覆盖旧的。
     * ⚠️ 不能简单地 append：外部跳章每发生一次文案都不同（from→to 变了），
     *    append 的话用户手动翻 30 章，页面上就堆 30 行红字。
     *    按种类覆盖 = 永远只有「多实例」和「外部跳章」两行，
     *    发生了几次由文案里的「第 N 次」体现。 */
    const selfCheckMsgs = [];   // [{ key, text }]
    function showSelfCheckHint(key, text) {
        const i = selfCheckMsgs.findIndex((m) => m.key === key);
        if (i >= 0) {
            if (selfCheckMsgs[i].text === text) return;   // 内容没变，不重绘
            selfCheckMsgs[i].text = text;
        } else {
            selfCheckMsgs.push({ key, text });
        }
        if (!document.body) return;
        let d = document.getElementById('gxb-helper-diag');
        if (!d) {
            d = document.createElement('div');
            d.id = 'gxb-helper-diag';
            d.style.cssText = [
                'position:fixed', 'left:16px', 'bottom:16px', 'z-index:2147483647',
                'max-width:360px', 'padding:12px 14px', 'border-radius:8px',
                'background:#ffe3e3', 'color:#8a1c1c', 'border:1px solid #ffb3b3',
                'font:13px/1.6 -apple-system,"Microsoft YaHei",sans-serif',
                'box-shadow:0 4px 16px rgba(0,0,0,.18)',
            ].join(';');
            document.body.appendChild(d);
        }
        d.textContent = selfCheckMsgs.map((m) => '[高校邦助手·自检] ' + m.text).join('\n');
    }

    function checkMultiInstance() {
        if (multiInstanceWarned) return;      // 只喊一次，否则每秒刷屏
        const n = countRunningInstances();
        if (n <= 1) return;
        multiInstanceWarned = true;
        console.warn(
            '[高校邦助手] ⚠️ 检测到页面上同时运行着 ' + n + ' 份「高校邦助手」' +
            '（同名按钮出现了 ' + n + ' 个）。\n' +
            '  这几乎肯定是篡改猴里还留着旧版本。旧版本会按它自己的规则抢跳章，\n' +
            '  于是本版本的修复看起来「无效」—— 实测过：新版正确地停住，旧版照样跳走。\n' +
            '  处理：篡改猴 → 管理面板 → 只保留最新版，其余全部删除或停用，然后刷新页面。'
        );
        showSelfCheckHint('multi',
            '检测到 ' + n + ' 份「高校邦助手」同时运行（篡改猴里还有旧版本），' +
            '旧版本会抢跳章。请到篡改猴管理面板只保留最新版，然后刷新本页。'
        );
    }

    /* ============================================================
     *  ② 外部跳章侦测（跨页面交接）
     *
     *  ⚠️⚠️ 这一块返工过一次，原因必须写下来：
     *
     *  第一版是【纯内存】的 —— goNext 里记一个 4 秒窗口，主循环比对内存里的
     *  章节 key。当时的假设是「站点在页面内换 hash」。拿到真实取证日志后发现
     *  **假设是错的**，本站切章是【整页重载】：
     *
     *    [00:15:07] NAV .../chapter/5598957#!...chapterId=5598958&onChange=true  ← 先改 hash 触发路由
     *    [00:15:07] NAV .../chapter/5598958#!...chapterId=5598958                ← 再改 pathname
     *    [00:15:07] LOG [高校邦助手] v2.5.3 已加载 …                              ← 横幅又打一遍 = 文档重载
     *
     *  monitor.log 里 6 次横幅 / 5 次切章，一一对应。
     *  ⇒ 重载后本实例已销毁、内存状态清零 → 纯内存的侦测**在本站永远不会触发**。
     *    那就是一段「看起来正确、实际没用」的代码。
     *  ⇒ 改成把交接信息写进 sessionStorage，让它**跨页面存活**。
     *
     *  教训：只验证「机制能跑通」不够，还要验证「这个站到底走哪条路径」。
     *        凡「两个页面的关系」这类论据，必须在真实日志上复核。
     * ============================================================ */

    /* 当前章节标识。
     * pathname 和 hash 里的 chapterId 都取，任一变化都算换章。
     * （实测重载时两者都会变，但 hash 先变 —— 两个都取更稳。） */
    function chapterKey() {
        const p = (location.pathname.match(/\/chapter\/(\d+)/) || [])[1] || '';
        const h = (location.hash.match(/chapterId=(\d+)/) || [])[1] || '';
        return p + '/' + h;
    }

    const SELFNAV_KEY = 'gxb-helper:selfnav';
    let navRec = null;          // 内存副本，避免每轮都读 sessionStorage
    let foreignNavCount = 0;

    function writeNavRec(chapter, leftBy) {
        try {
            sessionStorage.setItem(SELFNAV_KEY,
                JSON.stringify({ chapter: chapter, leftBy: leftBy, at: Date.now() }));
        } catch (e) {
            /* 隐私模式 / 存储被禁用时 sessionStorage 会抛异常。
             * 这只是自检功能，不能因为它把整个脚本搞崩 —— 静默降级。 */
        }
    }

    /* 标记「这一次离开页面是【谁】造成的」。
     *   'me'   = 本脚本点的「下一章」
     *   'user' = 用户点了链接
     * 'me' 优先级最高：goNext 是先 markLeave('me') 再 click()，
     * 而 click 会触发下面的捕获监听器（标成 'user'）—— 不能被它覆盖掉。 */
    function markLeave(by) {
        if (!navRec || navRec.leftBy === 'me') return;
        navRec.leftBy = by;
        writeNavRec(navRec.chapter, by);
    }

    function reportForeignNav(from, to) {
        foreignNavCount++;
        console.warn(
            '[高校邦助手] ⚠️ 检测到「外部跳章」：' + from + ' → ' + to +
            '（第 ' + foreignNavCount + ' 次），但这一次不是本脚本发起的。\n' +
            '  如果你没有手动点章节，就说明页面上还有另一个脚本（多半是旧版本）在抢跳 ——\n' +
            '  请到篡改猴管理面板只保留最新版。'
        );
        showSelfCheckHint('foreign',
            '本页被跳到了别的章节（' + from + ' → ' + to + '），但这次不是本脚本发起的' +
            '（第 ' + foreignNavCount + ' 次）。' +
            '如果你没手动点，请检查篡改猴里是否还留着旧版本。'
        );
    }

    /* 【v2.5.11】只有【两边都是章节】才谈得上「外部跳章」。
     *
     * chapterKey() 在非章节页返回 '/'（既没有 /chapter/<id>，也没有 chapterId=）。
     * 于是「章节页 → 目录页」这种正常导航会被当成「5598990/5598990 → /」，
     * 误报「⚠️ 检测到外部跳章 … 请检查篡改猴里是否还留着旧版本」——
     * 用户一进目录页就吃一条假警报。正是本项目最反对的「诊断张冠李戴」。
     *（已用夹具实测复现，见 test-v2511.mjs 的 T3。） */
    const isChapterKey = (k) => /\d/.test(String(k || ''));

    /* 一个函数同时覆盖两种情况，不需要两套机制：
     *   · 整页重载 —— 脚本重新启动时 navRec===null，从 sessionStorage 读【上一页】留下的记录
     *   · 页面内切章 —— 主循环里发现 key 变了
     * 主循环每秒调一次，所以两种情况都漏不掉。 */
    function checkNavAttribution() {
        const now = chapterKey();

        if (navRec === null) {
            let prev = null;
            try { prev = JSON.parse(sessionStorage.getItem(SELFNAV_KEY) || 'null'); } catch (e) { prev = null; }
            if (prev && prev.chapter && prev.chapter !== now &&
                isChapterKey(prev.chapter) && isChapterKey(now) &&
                prev.leftBy !== 'me' && prev.leftBy !== 'user') {
                reportForeignNav(prev.chapter, now);
            }
            navRec = { chapter: now, leftBy: 'unknown' };
            writeNavRec(now, 'unknown');
            return;
        }

        if (navRec.chapter === now) return;
        const from = navRec.chapter;
        if (isChapterKey(from) && isChapterKey(now) &&
            navRec.leftBy !== 'me' && navRec.leftBy !== 'user') reportForeignNav(from, now);
        navRec = { chapter: now, leftBy: 'unknown' };
        writeNavRec(now, 'unknown');
    }

    /* 用户手动点链接离开 → 记成 'user'，避免把自己的操作报成「外部抢跳」。
     * 用捕获阶段，确保早于站点自己的处理。 */
    document.addEventListener('click', (e) => {
        const t = e.target;
        const a = t && t.closest ? t.closest('a') : null;
        if (a) markLeave('user');
    }, true);

    /* 【v2.5.11】目录页的播报只做一次。
     *   主循环每秒跑一轮，不拦着就会每秒刷一条同样的告警。 */
    let catalogHinted = false;

    // 【v2.3.0】主循环固定 1000ms，对齐旧插件的节奏。
    // 原 1500ms + 进入 handleVideoPage 的多重前置条件，导致「播完了要等一会才跳」，
    // 用户实测体感明显不如旧插件。旧插件就是每秒无条件轮询，简单但快。
    // 这里回调本身仍是重入安全的（各项操作都有 busy 锁），加快频率不会重复触发。
    setInterval(() => {
        const kind = detectPageKind();

        // 【v2.5.0】需求1：按钮要一直存在（页面 SPA 切换时可能被移除）
        renderPauseButton();
        /* 【v2.5.20】顶部面板同理。⚠️ 放在下面 `if (isPaused()) return;` 之前 ——
         *   暂停时面板必须仍然可见，否则用户点不了「▶ 恢复」。 */
        renderTopBar();
        // 【v2.5.0】需求4：每次轮询都补扫一遍播放器，防漏网
        installInstantMute();

        /* 【v2.5.4】运行环境自检。刻意放在「暂停判定」之前：
         * 暂停是「先别做」，不是「别告诉我」—— 出了问题更要看得见。 */
        checkMultiInstance();
        checkNavAttribution();

        /* 【v2.5.0】需求1：全局暂停 —— 暂停后所有自动功能停摆。
         * 放在最前面，连答题观察器都不挂：用户按了暂停就该彻底安静。
         * ⚠️ 不等于关闭功能：功能开关是「做不做」，暂停是「现在先停」，
         *    两者语义不同，所以暂停时按钮文案必须自己说明状态。 */
        if (isPaused()) {
            updatePauseButtonHint('已暂停 · 点击继续');
            return;
        }

        /* 【v2.5.12b】离开「目录页 / 整卷测验页」时解除按钮文案钉住。
         *   否则在测验页挂上的「测验页 · 不自动作答」会跟着用户跳到视频页，
         *   那时按钮写着「不自动作答」但脚本其实在正常答题 —— 又是一个撒谎的播报。
         *   判据（失败方向）：先解除再重设，最坏结果是多刷一次文案（可见、无害）；
         *   不解除的最坏结果才是「按钮长期撒谎」。 */
        /* 【v2.5.13】整卷测验页：AI 作答（默认关）。判据 43：失败方向安全 ——
         * 出错就停 + 说清停在哪一步，不拿残缺卷凑合交。 */
        handleWholePaperQuiz();
        reportSubmissionResult();

        if (pinnedHint > 0 && !isCatalogUrl() && !isWholePaperQuizPage().whole) {
            pinnedHint = 0;
        }

        /* ---- 【v2.5.15】页面作用域守卫：非学习页 ⇒ 什么都不干 ----
         * 用户报：「课程公告 / 成绩分析 / 测验列表 / 作业 / 考试 / 讨论区 /
         * 错题本 / 拓展内容」这些页右下角也写「运行中」。
         *
         * 实测证据（browser-demo/_pages/ 真机 DOM + test-v2515.mjs）：
         *   这 8 页里 **3 页**（/quiz 列表、/assignment、/wrong）的 DOM
         *   与答题页高度相似（.question-item / .quiz-item / .answer-wap 都在），
         *   detectPageKind() 会把它们判成 **quiz** ⇒ 旧版会挂答题观察器。
         *   错题本那次实测侥幸没点（拿不到「正确答案」元素就 return），
         *   但这是**靠运气**——站点改版给错题本加上答案标记就会真点。
         *
         * ⚠️ 放在此处（目录页守卫【之前】）的理由：
         *    目录页守卫的文案与播报要原样保留（v2.5.11 的行为契约），
         *    而本守卫只拦「用户点名的非学习页」，两者集合不重叠。
         *
         * ⚠️ 播报用 console.warn 而不是 log()：
         *    「脚本为什么不动」不能被 debug 开关连坐（本项目反复踩过）。
         * ------------------------------------------------------ */
        const _scope = pageScope();
        if (!_scope.run) {
            /* 【v2.5.15b】目录页【例外】：它虽然也在「不跑」集合里，
             *   但 v2.5.11 给了它【自己的文案与播报】（「目录页 · 不自动跳章」），
             *   那是既有的行为契约 —— 分流回下面那条守卫，别用通用播报顶掉。
             *   判据：认得出目录页、且它的文案更具体 ⇒ 用更具体的那条。 */
            if (!isCatalogUrl()) {
                updatePauseButtonHint(_scope.hint, 1);
                if (scopeHinted !== location.pathname) {
                    scopeHinted = location.pathname;
                    console.warn(
                    '[高校邦助手] 本页是【' + _scope.why + '】，不是章节页也不是整卷测验页 ——' +
                    '\n  按设计【本页不运行任何自动功能】（不刷课、不答题、不回复讨论）。\n' +
                    '  ✅ 想自动刷课：进任意一章（/unit/<unit>/chapter/<chapter>/）。\n' +
                    '  ✅ 想自动答题：点开某一套测验（/quiz/<数字>/）。\n' +
                    '  ℹ️ 视频里的随堂弹题、章节内的讨论页不受影响。'
                );
            }
            return;
            }
        }

        /* ---- 【v2.5.11】目录页守卫：不是章节页 ⇒ 绝不跳章 ----
         * 用户报：「该页面为目录页面，不要自动跳章」（/class/12345/unit）。
         *
         * 根因链（逐段读代码确认，并已用夹具复现）：
         *   ① 目录页没有播放器/题目/讨论容器，但【目录容器在】（它本身就是目录）
         *      ⇒ detectPageKind() 落到最后一条兜底 → 判成 doc；
         *   ② isChapterSettled('doc')：目录页没有 curFilmPlay ⇒ currentNodeItem() 为 null
         *      ⇒ readCatalogState()/readChapterProgress() 都读不到 ⇒「无进度信号，等时间窗」；
         *   ③ maybeAdvance 的情况 D：停留超过 docGraceMs → goNext()；
         *   ④ findNextChapter() 的兜底是「第一个未完成的章节」⇒ 直接跳进某一章。
         *   复现日志：本章无进度信号（doc），停留 4s 后跳过 → 跳转下一章: 1.2 未完成的课件
         *
         * 为什么必须在【这里】拦：
         *   目录页是【导航枢纽】—— 用户可能正停在那儿挑章节。
         *   这一页不该有任何自动动作，所以直接 return，连 settled 都不必算。
         *
         * ⚠️ 播报用 console.warn 而不是 log()：
         *    「脚本为什么不动」这件事不能被 debug 开关连坐（本项目反复踩过）。
         *
         * ⚠️ 判据是「认得出目录页才拦」（见 isCatalogUrl 的注释）——
         *    不是「不是章节页就拦」。后者会让「站点改 URL 形态」变成
         *    「整个脚本静默空转」，那比这个 bug 本身严重得多。
         * ------------------------------------------------------ */
        if (isCatalogUrl()) {
            /* 除了控制台，也在右下角按钮上写一句 ——
             *   用户逛目录页时不会打开 F12，只在控制台吭声等于没吭声，
             *   他只会觉得「脚本没反应 = 坏了」。而那个按钮本来就一直挂在页面上。 */
            /* 【v2.5.12b】同理：这条也是「为什么不动」的说明，优先级 1。 */
            updatePauseButtonHint('目录页 · 不自动跳章', 1);
            if (!catalogHinted) {
                catalogHinted = true;
                console.warn(
                    '[高校邦助手] 本页是【课程目录】，不是章节页 —— 按设计【不自动跳章】。\n' +
                    '  目录页是你挑章节的地方，脚本不会替你选。\n' +
                    '  ✅ 想继续自动刷课：点进任意一章，脚本会从那一章接着往下跳。'
                );
            }
            return;
        }

        // 答题观察器与页面类型【解耦】：无条件挂着（成本极低）。
        // 原实现只在 quiz 分支挂，于是「独立测验页 / 弹窗式答题 / 类名不匹配」
        // 这些情况脚本完全不动（实测暴露）。挂在最外层就不会漏。
        /* 【v2.5.8】例外：测验 / 作业章 + 「跳过」模式 → 不挂观察器。
         *   实测（probe-quiz-race.mjs）：这种组合下页面约 1s 就被跳走，答题链路
         *   只来得及点第 1 题就没了 —— 留下一条误导性的「已作答第 1 题」日志，
         *   外加一个点了半道的答案。既然设置是「跳过」，就该真的不碰它。
         *   视频内弹题不受影响（那种页面 kind = video，不满足本条件）。 */
        const quizChapterIsSkipped =
            kind === PAGE_KIND.quiz && cfg('skipNonVideo') && cfg('quizChapterMode') === 'skip';
        if (!quizChapterIsSkipped) attachQuizObserver();

        /* ---------- 【v2.4.0】全内容类型统一跳章 ----------
         * 不再「视频走一套、非视频走另一套」。所有类型都问同一个问题：
         * 「这一章按目录/播放器看，能不能走了？」
         * 能走就统一跳，不能走再按类型做该做的处理。
         * ------------------------------------------------ */
        const settled = isChapterSettled(kind);

        /* 【v2.5.0】需求2：算出「本页是否已是最后一章」，供 maybeAdvance 用。
         * 只在还没宣告完成时重算，避免宣告后又变回去。 */
        if (!allDone) {
            const last = checkIsLastChapter();
            if (last) {
                finishedHere = last.isLast;
                // 按钮上顺带播报进度，用户不用翻日志
                if (!paused && last.total > 1) {
                    updatePauseButtonHint('运行中 ' + (last.index + 1) + '/' + last.total);
                }
            }
        }

        // 【v2.5.0】已宣告刷完 → 撤掉所有自动行为，只留按钮
        if (allDone) {
            return;
        }

        if (kind === PAGE_KIND.topic) {
            handleTopicPage();
            // 讨论页：只有提交成功才跳（用户明确选择「出错就停下等配置」）
            maybeAdvance(kind, settled);
            return;
        }

        // 确认已经离开讨论页 → 重置讨论状态，便于下一个讨论页复用。
        // 【v2.4.0】原来这行写在每轮结尾【无条件】执行，等于每秒把状态抹一次，
        // 任何有粘性的状态（如 'failed'）都保不住，重试就会失控。
        if (topicState !== 'idle') {
            topicState = 'idle';
            topicRetry = 0;
            topicFailedReason = '';
            topicDoneReason = '讨论已提交';
            topicHintLogged = false;
            hideStuckHint();
            hideTopicNote();
        }

        if (kind === PAGE_KIND.video || kind === PAGE_KIND.audio) {
            handleVideoPage();
        } else {
            // quiz / doc / unknown：答题逻辑在观察器里跑，这里只负责判定跳章
            if (kind === PAGE_KIND.quiz) handleQuizPageGating();
        }

        maybeAdvance(kind, settled);
    }, 1000);

    /* ------------------------------------------------------------
     * 【v2.4.0】统一的「是否推进到下一章」决策
     * 所有页面类型共用。决策顺序：
     *   1. 开关关了 → 不动
     *   2. 目录/播放器说本章已完成 → 立即跳
     *   3. 读不到进度（doc，或目录结构认不出）→ 给时间窗，超时才跳
     *      ⚠️【v2.5.3】video / audio 【不适用】这一条 —— 它们**有**进度信号，
     *        只是信号可能说「还没播完」。没播完 ≠ 读不到，两者绝不能混为一谈。
     *        详见 maybeAdvance 里的「情况 D-」。
     *   4. 讨论页特例：AI 失败/未配 Key → 停下 + 弹提示（不静默、也不硬跳）
     * ---------------------------------------------------------- */
    /* 【v2.5.3】媒体页「已经提示过等待原因」的路径集合（避免每秒刷屏） */
    const mediaWaitHinted = new Set();

    function maybeAdvance(kind, settled) {
        /* ---- 【v2.5.0 新增】先判「是不是已经刷完了」----
         * 必须放在【所有】其他判断之前，尤其是「讨论页失败提示」之前。
         * 否则最后一章会被误报成「讨论未提交（返回内容为空）」——
         * 用户实测遇到的正是这个假警报。
         *
         * 顺序理由：这是「任务是否已终结」的判断，层级高于
         * 「本章是否卡住」——已终结就无所谓卡不卡。
         * ------------------------------------------------------ */
        if (allDone) {
            // 已宣告过 → 只保证停在那里，不重复刷屏
            return;
        }
        if (finishedHere) {
            /* 已经刷到最后一章：
             *   - 如果目录显示本章也完成了 → 宣告整门课刷完，停止
             *   - 否则说明最后一章还没做完 → 继续正常流程（不能提前收工）
             */
            if (settled.settled) {
                declareAllDone(kind);
                return;
            }
        }

        /* ---- 【v2.4.0】讨论页失败提示：必须放在开关守卫【之前】 ----
         * 这是「状态播报」而不是「要不要跳章」的决策。放在守卫后面会导致：
         * 用户关掉「自动跳下一章」或「非视频章节自动跳过」时，脚本卡在讨论页
         * 却一句话都不提示 —— 用户看到的就是「脚本坏了」。
         * 用户 v2.2.1 的原话是「出错时停下来等我配置 AI」，停下必须伴随告知。
         * ------------------------------------------------------ */
        if (kind === PAGE_KIND.topic && topicState === 'failed') {
            if (!topicHintLogged) {
                topicHintLogged = true;
                console.warn(
                    '[高校邦助手] 讨论页已停下等你处理：' + (topicFailedReason || 'AI 调用失败') + '。\n' +
                    '  脚本按设置【不会提交任何内容】（避免发出与题目无关的回复）。\n' +
                    '  处理办法：手动回复本页，或在面板「设置」 配好接口后刷新本页。\n' +
                    '  若不想让它管讨论页，可在面板「设置」 把「讨论题处理方式」改成「跳过」。'
                );
            }
            showStuckHint(
                '本页讨论未提交（' + (topicFailedReason || 'AI 调用失败') + '）。' +
                '脚本已按设置【不提交任何内容】。你可以手动回复，' +
                '或在面板「设置」 配好接口后刷新本页重试；' +
                '也可以把面板「设置」 改成「跳过」或「抄答案」。'
            );
            return;   // 不跳，也不继续走跳章判断
        }

        if (!cfg('autoNext')) return;
        if (!cfg('skipNonVideo') && kind !== PAGE_KIND.video && kind !== PAGE_KIND.audio) return;

        // 保证进入时间已记录
        if (lastPath !== location.pathname) {
            lastPath = location.pathname;
            pageEnteredAt.set(location.pathname, Date.now());
        }
        if (!pageEnteredAt.has(location.pathname)) {
            pageEnteredAt.set(location.pathname, Date.now());
        }
        const enteredAt = pageEnteredAt.get(location.pathname);
        const stayed = Date.now() - enteredAt;
        const grace = Math.max(3000, Number(cfg('docGraceMs')) || 12000);

        // ---- 情况 A：明确已完成 → 立即跳 ----
        if (settled.settled) {
            // 先看上一次点击是不是「点了没反应」（有些站点首次点击被播放器
            // 事件吃掉、或按钮还在动画中）。有则清掉 state 让它重试一次。
            if (jumpSeemsStuck()) {
                log('上一章跳转似乎未生效，重试一次');
                lastJump = null;
            }
            log('本章已完成（' + settled.reason + '），跳下一章');
            pageEnteredAt.set(location.pathname, Number.MAX_SAFE_INTEGER); // 防重复
            hideStuckHint();
            goNext();
            return;
        }

        // ---- 情况 B：讨论页处理中（尚未失败）→ 不跳，等它处理完 ----
        // 注意：讨论页【失败】的情形已经在本函数开头统一处理掉了（早于开关守卫），
        // 这里只剩「还在 working / 刚进来还没开始」——安静等着即可。
        if (kind === PAGE_KIND.topic) return;

        /* ---- 【v2.5.0 新增】情况 C-：作业 / 考试页 → 【立刻】跳 ----
         * 用户诉求：「跳章节遇到除视频和讨论外的章节（作业，考试）都直接跳」
         * 用户选择：「立刻跳，不等」—— 不等 12 秒宽限期。
         *
         * ⚠️ 顺序要求：必须在「情况 C 测验」之前。
         *    因为 Assignment（作业）在页面类型识别里可能被归为 quiz
         *    （它有答题元素），若不提前拦，作业页会被当作测验页
         *    等 grace*3 秒（默认 36 秒）——用户会觉得「卡住了」。
         *
         * 【v2.5.8】例外：面板「设置」 选「先答完再跳」时，isSkipInstantlyKind 对
         *    quiz 返回 false，测验 / 作业章【不再走这一支】，而是落到下面的
         *    情况 C 等答题。默认 'skip' 时这一支照旧生效，行为与 v2.5.0 起一致。
         * ------------------------------------------------------ */
        if (isSkipInstantlyKind(kind)) {
            // 立刻跳；找不到下一章则退化为「没什么可做」，安静待着
            if (finishedHere) {
                // 已是最后一章 → 交给上面的刷完宣告（它在 settled 时生效）
                return;
            }
            const next = findNextChapter();
            if (!next) {
                // 最后一章或目录认不出 → 不弹「找不到入口」的噪音日志
                if (!allDone) log('本页（' + kind + '）无下一章可跳，保持不动');
                return;
            }
            log('本页是' + (KIND_CN[kind] || kind) + '，按设置直接跳过');
            pageEnteredAt.set(location.pathname, Number.MAX_SAFE_INTEGER);
            hideStuckHint();
            goNext();
            return;
        }

        /* ---- 情况 C：测验 / 作业页 —— 给答题让路，超时兜底 ----
         * 【v2.5.8】这一段现在【真的可达】了。v2.5.7 及以前，上面的情况 C-
         *   对 quiz 无条件 return ⇒ 这里永远是死代码（实测：3/6/10 题的测验页
         *   都在约 1s 时被跳走，只来得及点第 1 题）。现在只有面板「设置」 选
         *   「先答完再跳」才会走到这里。
         * ------------------------------------------------------ */
        if (kind === PAGE_KIND.quiz && cfg('quizChapterMode') === 'answer' && stayed < grace * 3) {
            return;   // 给答题留足时间（3 倍宽限），别抢跳
        }
        if (kind === PAGE_KIND.quiz && cfg('quizChapterMode') === 'answer' && stayed >= grace * 3) {
            /* 超时仍未交卷 —— 必须说明原因，不能静默跳走（下面是情况 D 的兜底跳）。
             * 最可能的原因：正确答案没下发到前端（SEL.correct 全不中，脚本读不到
             * 就没法答），或题量太大 / 加载太慢。
             * ⚠️ 用 console.warn 而非 log()：这条是「可能没做完」的告警，
             *    不能被 debug 开关连坐（本项目反复踩过这个坑）。 */
            console.warn(
                '[高校邦助手] 测验 / 作业页已等待 ' + Math.round((grace * 3) / 1000) +
                's 仍未交卷，超时跳过本章。\n' +
                '  若本章题目没答完，可能是：① 正确答案没在页面 DOM 里（脚本读不到就没法答）；\n' +
                '  ② 题目太多或加载太慢。可把面板「设置」 改回「跳过」，或手动完成本章。'
            );
        }

        /* ---- 【v2.5.3 修复】情况 D-：媒体页【绝不】吃「时间窗兜底」 ----
         *
         * 这是用户报的「视频在 88% / 89% 就被跳章」的**真正根因**。
         *
         * 实测取证（可监控浏览器 + 打开 debug 后的原始日志）：
         *   [23:41:15] [高校邦助手] 本章无进度信号（video），停留 13s 后跳过
         *   [23:41:15] [高校邦助手] 跳转下一章:
         *   [23:41:15] NAV  .../chapter/5598957 → chapterId=5598958&onChange=true
         * 这行日志出自下面的「情况 D」，**不是** isChapterSettled 的媒体分支。
         *
         * 完整逻辑链：
         *   isChapterSettled('video') 读到平台进度条 = 88% → 返回 { settled:false }
         *   → 情况 A 不成立
         *   → 情况 B/C-/C 都不适用（video 既不是讨论，也不是作业/测验）
         *   → 落到情况 D → stayed(13s) >= grace(12s) → goNext()
         * **v2.5.2 只改了「判定顺序」，没堵住「兜底」，所以照样跳。**
         *
         * 情况 D 的注释本来就写着「读不到进度（doc/unknown）」——
         * 它是给**没有任何进度信号**的页面准备的。而视频/音频恰恰有信号，
         * 只是信号说「还没播完」。没播完 ≠ 读不到，不能拿 doc 的兜底去套媒体。
         *
         * 因此：媒体页的唯一放行条件是 isChapterSettled().settled === true（情况 A）。
         * 进度没到就【必须停在这里】，哪怕停很久 —— 这是用户明确的语义：
         *   「视频没播放完就跳了」→ 宁可等着，也不能跳。
         *
         * ⚠️ 唯一例外：连【一个进度信号都读不到】（没有播放器元素、也没有
         *    平台进度条）—— 那才符合情况 D 的本意「读不到进度」，
         *    允许落到下面的时间窗兜底。这一支比 v2.5.2 严格得多：
         *    v2.5.2 是「只要没跳成就兜底」，现在是「两个来源全空才兜底」。
         *
         * ⚠️ 「停下」必须伴随「说明原因」。否则用户只看到它不动，
         *    无法区分「在等视频播完」「播放器卡住了」「脚本坏了」。
         *    所以第一次超过宽限期时，控制台 + 页面右下角都要给出原因。
         * ------------------------------------------------------ */
        if ((kind === PAGE_KIND.video || kind === PAGE_KIND.audio) &&
            (findMedia() || readPercentText())) {

            if (stayed >= grace && !mediaWaitHinted.has(location.pathname)) {
                mediaWaitHinted.add(location.pathname);
                const mp = readMediaProgress();
                console.warn(
                    '[高校邦助手] 本页（' + kind + '）媒体未播完，已停止自动跳章：' + mp.reason + '\n' +
                    '  放行条件：平台进度条 = 100，或播放器 ended。' +
                    '「读不到进度的时间窗兜底」对视频/音频不生效。\n' +
                    '  若播放器已经停住不动 → 手动点一下播放；\n' +
                    '  若平台进度条明明 100% 却报未播完 → 把这行 reason 发给开发者。'
                );
                showStuckHint(
                    '本页' + (KIND_CN[kind] || kind) + '未播完（' + mp.reason + '），' +
                    '已停止自动跳章，播完后会自动继续。'
                );
            }
            return;
        }

        // ---- 情况 D：读不到进度（doc / 测验超时）→ 时间窗兜底 ----
        //   ⚠️【v2.5.3】video / audio 在「有进度信号」时已于上面 return，
        //     只有「连一个进度信号都读不到」才会走到这里。
        if (stayed >= grace) {
            const next = findNextChapter();
            if (!next) {
                console.warn(
                    '[高校邦助手] 本章（' + kind + '）停留超时，但找不到「下一章」入口。清单：\n' +
                    (dumpChapterCandidates().join('\n') || '(页面上没有任何含 chapter/next 的元素)')
                );
                return;
            }
            log('本章无进度信号（' + kind + '），停留 ' + Math.round(stayed / 1000) + 's 后跳过');
            pageEnteredAt.set(location.pathname, Number.MAX_SAFE_INTEGER);
            goNext();
        }
    }

    /* ------------------------------------------------------------
     * 【v2.5.0 新增】需求2：整门课刷完的宣告与停止
     *
     * 用户诉求：「应该读取目录信息，自己发现这是最后一章，
     *           然后提示已刷完并停止」
     *
     * 这解决的不只是弹窗文案 —— 更重要的是【停止】：
     * 原实现在最后一章会每秒重试 AI、每秒弹一次「讨论未提交」，
     * 刷爆 API 配额，用户也看不懂发生了什么。
     * ---------------------------------------------------------- */
    let allDone = false;
    let finishedHere = false;   // 本页是否已是目录里的最后一章

    function declareAllDone(kind) {
        allDone = true;
        hideStuckHint();          // 撤掉可能存在的「卡住」黄条（那多半是假警报）
        renderPauseButton();

        let info = '';
        try {
            const items = chapterItems();
            const cur = currentNodeItem();
            const idx = cur ? items.indexOf(cur) : -1;
            const doneCount = items.filter((it) => isItemDone(it)).length;
            if (idx >= 0) {
                info =
                    '\n\n课程进度：第 ' + (idx + 1) + ' / ' + items.length + ' 章' +
                    '（目录显示已完成 ' + doneCount + ' 章）';
            }
        } catch (e) {}

        const msg =
            '🎉 全部章节已刷完！脚本已停止工作。' +
            info +
            '\n\n这一页是目录里的最后一章' + (kind ? '（' + kind + '）' : '') + '，' +
            '没有后续章节可跳，因此不再执行任何自动操作。' +
            '\n如需继续使用，刷新页面或点击右下角按钮。';

        // ① 页面内绿条（与「卡住」黄条、蓝按钮都不撞色）
        showDoneHint(msg);
        // ② 控制台留一条完整记录
        console.log('[高校邦助手] ' + msg.replace(/\n+/g, ' '));
    }

    /* 刷完提示条：绿色，与「卡住」黄条区分开 */
    let doneHintEl = null;
    function showDoneHint(text) {
        if (doneHintEl && document.body.contains(doneHintEl)) return;
        if (!document.body) return;
        const d = document.createElement('div');
        d.id = 'gxb-helper-done';
        d.style.cssText = [
            'position:fixed', 'right:16px', 'bottom:70px', 'z-index:2147483647',
            'max-width:360px', 'padding:12px 14px', 'border-radius:8px',
            'background:#d1f4d9', 'color:#0a3622', 'border:1px solid #a3e0b5',
            'font:13px/1.6 -apple-system,"Microsoft YaHei",sans-serif',
            'box-shadow:0 4px 16px rgba(0,0,0,.15)', 'white-space:pre-wrap',
        ].join(';');
        d.textContent = '[高校邦助手] ' + text;
        document.body.appendChild(d);
        doneHintEl = d;
    }
    function hideDoneHint() {
        if (doneHintEl && document.body.contains(doneHintEl)) doneHintEl.remove();
        doneHintEl = null;
    }

    /* ------------------------------------------------------------
     * 【v2.4.0】讨论页卡住时的页面内提示条
     * 用户要求：「停下但弹提示告诉我」—— 避免以为脚本坏了。
     * ---------------------------------------------------------- */
    let stuckHintEl = null;
    function showStuckHint(text) {
        if (!cfg('topicStuckHint')) return;
        if (stuckHintEl && document.body.contains(stuckHintEl)) return;
        const d = document.createElement('div');
        d.id = 'gxb-helper-hint';
        d.style.cssText = [
            'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647',
            'max-width:340px', 'padding:12px 14px', 'border-radius:8px',
            'background:#fff3cd', 'color:#664d03', 'border:1px solid #ffe69c',
            'font:13px/1.6 -apple-system,"Microsoft YaHei",sans-serif',
            'box-shadow:0 4px 16px rgba(0,0,0,.15)',
        ].join(';');
        d.textContent = '[高校邦助手] ' + text;
        document.body.appendChild(d);
        stuckHintEl = d;
    }
    function hideStuckHint() {
        if (stuckHintEl && document.body.contains(stuckHintEl)) stuckHintEl.remove();
        stuckHintEl = null;
    }

    /* 【v2.5.5】「本页讨论是怎么处理的」说明条。
     *
     * ⚠️ 为什么不能用 showStuckHint：它会被 hideStuckHint() 清掉，
     *    而【跳章成功那一刻正好会调 hideStuckHint()】——
     *    于是「按设置跳过」这句话刚弹出来就被抹掉，用户根本看不见。
     *    实测就是这么漏掉的（测试去读提示条时元素已经没了）。
     * ⇒ 用自己的元素，且放在【底部居中】，不和左下角的自检条打架。 */
    let topicNoteEl = null;
    function showTopicNote(text) {
        if (!document.body) return;
        if (!topicNoteEl || !document.body.contains(topicNoteEl)) {
            topicNoteEl = document.createElement('div');
            topicNoteEl.id = 'gxb-helper-topic-note';
            topicNoteEl.style.cssText = [
                'position:fixed', 'left:50%', 'transform:translateX(-50%)', 'bottom:16px',
                'z-index:2147483645', 'max-width:420px', 'padding:10px 14px', 'border-radius:8px',
                'background:#e7f5ff', 'color:#0b4a6f', 'border:1px solid #a5d8ff',
                'font:13px/1.6 -apple-system,"Microsoft YaHei",sans-serif',
                'box-shadow:0 4px 16px rgba(0,0,0,.18)',
            ].join(';');
            document.body.appendChild(topicNoteEl);
        }
        topicNoteEl.textContent = '[高校邦助手] ' + text;
    }
    function hideTopicNote() {
        if (topicNoteEl && document.body.contains(topicNoteEl)) topicNoteEl.remove();
        topicNoteEl = null;
    }

    /* ------------------------------------------------------------
     * 【v2.4.0】测验页：只做门控，答题交给观察器
     * 记录「本章测验是否已交卷」，供 isChapterSettled 判定用。
     * ---------------------------------------------------------- */
    let quizSubmittedHere = false;
    function handleQuizPageGating() {
        // 交卷成功的标记由 answerQuizIfPresent 里设置（见 quizDone）
        if (!quizSubmittedHere && quizSubmittedPaths.has(location.pathname)) {
            quizSubmittedHere = true;
        }
    }
    const quizSubmittedPaths = new Set();

    // 首次运行：未配 API 时引导一次
    if (!cfg('apiUrl')) {
        setTimeout(() => {
            if (confirm('检测到尚未配置 AI 接口。\n\n未配置时，讨论页【不会自动提交任何内容】（避免发出与题目无关的回复）。\n视频播放、自动跳章、自动答题不受影响。\n\n现在配置？（之后可在篡改猴菜单里随时配置）')) {
                /* 【v2.5.5】先选服务商预设 —— 地址和模型名自动填好，只留 Key 给用户填 */
                chooseApiPreset();
                ask('API Key（保存在浏览器本地，不会写进源码）', 'apiKey', true);
            }
        }, 2500);
    }

    /* 【v2.5.20f】先放一条「启动记录」再画面板。
     *
     * 为什么需要：`log()` 在章节页的正常流程里几乎不被调用（主循环只调
     * `updatePauseButtonHint`，那个不走 log），启动横幅又是 console.log 直写
     * ⇒ 用户打开面板第一眼看到「（暂无日志）」，像功能没生效。
     * 这是**截图才发现的**：两条测试全绿，但实际观感像坏了。
     *
     * ⚠️ 写短：日志行是单行 + 省略号，长文案会被截成一片省略号。
     * ⚠️ 顺带有用：本项目反复踩「篡改猴里留着旧版本」的坑
     *    （旧版会抢跳章，新版看起来「无效」）—— 面板上写清版本号，
     *    用户一眼就能核对是不是新版在跑。 */
    pushLogRing('v' + SCRIPT_VERSION + ' 已加载');

    /* 【v2.5.20】立即画一次顶部面板 —— 不必等主循环的第一秒。
     *   ⚠️ 放在这里（脚本尾部）：此刻 document.body 必然就绪，
     *      而 renderTopBar() 内部也有 `if (!document.body) return;` 兜底。
     *   实测：不调这一句的话，注入后 600ms 面板还不存在（最长要等 1000ms），
     *   看起来像「没生效」。 */
    renderTopBar();

    console.log(
        '[高校邦助手] v' + SCRIPT_VERSION + ' 已加载 · AI 返回空内容时可诊断 + 按额度阶梯重试 · ' +
        '顶部可拖动/可最小化的控制面板（含最近日志，不用开 F12）· ' +
        '页面暂停（刷新后仍有效）+ 测验/作业章独立开关（默认跳过）· ' +
        '讨论题三选一（跳过/抄答案/接入API）+ 服务商预设 + 测试连接 + 回复语言自动跟随题目 · ' +
        '运行环境自检：多版本共存 / 跨页面抢跳会直接在页面上告警 · ' +
        '配置全部在顶部面板的「设置」里（菜单只留面板相关）'
    );

    /* 【v2.5.8】恢复暂停态时明确播报。
     * 用 console.warn 而非 log()：这条是「脚本为什么不动」的答案，
     * 不能被 debug 开关连坐 —— 否则用户刷新后看到它不动，会以为坏了。 */
    if (paused) {
        console.warn(
            '[高校邦助手] ⏸ 已恢复「暂停」状态（你在本标签页按过暂停，刷新 / 切章后仍然有效）。\n' +
            '  当前【不跳章、不答题、不回复讨论】。\n' +
            '  恢复运行：点右下角红色按钮「▶ 已暂停 · 点击继续」。'
        );
    }
})();
