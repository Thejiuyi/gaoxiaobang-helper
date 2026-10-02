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
// ⚠️ 本文件由 build-min.mjs 自动生成，请勿直接编辑。
//    要改代码请改同目录的 5-高校邦助手-全能合并版-v1.0.1-带注释.user.js，然后重新跑 build-min.mjs。
//    与源码的差别只有：删掉了注释与空行。代码本身一个字符都没动。
(function () {
    'use strict';
    const SCRIPT_VERSION = '1.0.1';
    const DEFAULTS = {
        apiUrl: '',
        apiKey: '',
        model: 'deepseek-chat',
        systemPrompt:
            '你是一名大学生，正在高校邦在线课程的讨论区参与讨论。' +
            '针对老师给出的讨论话题，写一段自然、口语化、像学生本人写的回复。' +
            '要求：紧扣话题且有具体观点；' +
            '【必须用与讨论话题相同的语言写】：题目是英文就全篇英文（不得出现中文字符），' +
            '题目是中文就用中文；' +
            '不要使用 markdown 标记或序号列表；不要出现「首先其次最后」这类套话；' +
            '不要暴露你是 AI；只输出回复正文，不要任何解释或前缀。',
        fallbackText: '',
        autoVideo: true,
        autoNext: true,
        autoQuiz: true,
        autoQuizPaper: false,
        disableThinking: true,
        topicMode: 'skip',
        apiPreset: '',
        autoTopicReply: true,
        autoTeacherReply: true,
        skipNonVideo: true,
        quizChapterMode: 'skip',
        antiBlur: true,
        showPauseBtn: true,
        docGraceMs: 12000,
        topicStuckHint: true,
        showTopBar: true,
        uiTopBarPos: '',
        uiTopBarMin: false,
        debug: false,
    };
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
    const cfg = (key) => GM_getValue(key, DEFAULTS[key]);
    const LOG_RING_MAX = 40;
    const logRing = [];
    function pushLogRing(line) {
        const t = String(line == null ? '' : line).replace(/\s+/g, ' ').trim();
        if (!t) return;
        if (logRing.length && logRing[logRing.length - 1] === t) return;
        logRing.push(t);
        if (logRing.length > LOG_RING_MAX) logRing.splice(0, logRing.length - LOG_RING_MAX);
    }
    const log = (...a) => {
        pushLogRing(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' '));
        if (cfg('debug')) console.log('[高校邦助手]', ...a);
    };
    (function migrateTopicMode() {
        if (GM_getValue('topicMode', undefined) !== undefined) return;
        const oldAuto = GM_getValue('autoTopicReply', true);
        GM_setValue('topicMode', oldAuto ? 'api' : 'skip');
        console.log('[高校邦助手] 已把旧的「AI 自动回复讨论=' + oldAuto + '」迁移为 topicMode=' +
            (oldAuto ? 'api' : 'skip') + '（可在面板「设置」 修改）');
    })();
    (function installAntiBlur() {
        if (!cfg('antiBlur')) return;
        const origAdd = window.addEventListener;
        const KILL = ['blur', 'visibilitychange', 'pagehide', 'mozvisibilitychange', 'webkitvisibilitychange'];
        let killed = 0;
        function patched(type, listener, options) {
            if (KILL.includes(type)) {
                killed++;
                if (cfg('debug')) console.log('[高校邦助手] 已拦截 ' + type + ' 监听器（防失焦暂停），累计 ' + killed + ' 次');
                return;
            }
            return origAdd.call(window, type, listener, options);
        }
        patched.__original = origAdd;
        try {
            Object.defineProperty(window, 'addEventListener', {
                value: patched, writable: false, configurable: true,
            });
        } catch (e) {
            window.addEventListener = patched;
        }
    })();
    const q = (sel, root = document) => root.querySelector(sel);
    const qa = (sel, root = document) => [...root.querySelectorAll(sel)];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const visible = (el) => !!el && el.offsetParent !== null;
    const shown = (sel) => visible(q(sel));
    const PAUSE_KEY = 'gxb-helper-paused';
    function readPauseFlag() {
        try { return sessionStorage.getItem(PAUSE_KEY) === '1'; } catch (e) { return false; }
    }
    function writePauseFlag(on) {
        try {
            if (on) sessionStorage.setItem(PAUSE_KEY, '1');
            else sessionStorage.removeItem(PAUSE_KEY);
        } catch (e) {  }
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
        renderTopBar();
    }
    let pauseBtnEl = null;
    function renderPauseButton() {
        if (!cfg('showPauseBtn') && !paused) {
            if (pauseBtnEl && document.body.contains(pauseBtnEl)) pauseBtnEl.remove();
            pauseBtnEl = null;
            return;
        }
        if (!document.body) return;
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
                if (paperReasonFull && !paperReasonSeen) {
                    paperReasonSeen = true;
                    try {
                        alert('测验未能自动作答，完整原因如下：\n\n' +
                            paperReasonFull +
                            '\n\n——\n（再点一次这个按钮 = 暂停/继续所有自动功能）');
                    } catch (_e) {  }
                    return;
                }
                if (submittedDetail && !submittedDetailSeen) {
                    submittedDetailSeen = true;
                    try {
                        alert(submittedDetail);
                    } catch (_e) {  }
                    return;
                }
                setPaused(!paused);
            });
            document.body.appendChild(d);
            pauseBtnEl = d;
        }
        if (paused) {
            pauseBtnEl.textContent = '▶ 已暂停 · 点击继续';
            pauseBtnEl.style.background = '#e5484d';
            pauseBtnEl.style.color = '#fff';
            pauseBtnEl.title = '所有自动功能已暂停：不跳章、不答题、不回复讨论（刷新后仍保持暂停，点此继续）';
        } else {
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
    let pinnedHint = 0;
    function updatePauseButtonHint(extra, priority) {
        const w = Number(priority) || 0;
        if (!pauseBtnEl) return;
        if (paused) return;
        if (w < pinnedHint) return;
        pinnedHint = w;
        pauseBtnEl.textContent = extra ? '⏸ ' + extra : '⏸ 运行中 · 点击暂停';
        renderTopBar();
    }
    const TOPBAR_ID = 'gxb-helper-topbar';
    const TOPBAR_STYLE_ID = 'gxb-helper-topbar-style';
    let topBarEl = null;
    let topBarBodyEl = null;
    let topBarStatusEl = null;
    let topBarPauseEl = null;
    let topBarPos = readTopBarPos();
    let topBarMin = !!cfg('uiTopBarMin');
    let topBarDetailAt = 0;
    let topBarDragging = false;
    function readTopBarPos() {
        try {
            const raw = cfg('uiTopBarPos');
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (o && typeof o.left === 'number' && typeof o.top === 'number') return o;
        } catch (e) {  }
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
    function topBarStatusText() {
        if (paused) return '已暂停';
        const sc = pageScope();
        if (!sc.run) return sc.hint || '本页不适用';
        const t = pauseBtnEl && pauseBtnEl.textContent ? String(pauseBtnEl.textContent) : '';
        const s = t.replace(/^[⏸▶]\s*/, '').trim();
        return s || '运行中';
    }
    function readTopBarProgress() {
        if (paused) return '已暂停（不跳章 / 不答题 / 不回复）';
        if (!pageScope().run) return '本页不跑自动功能';
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
        return '视频 ' + on('autoVideo') + ' · 跳章 ' + on('autoNext') +
            ' · 弹题 ' + on('autoQuiz') + ' · 整卷 ' +
            (cfg('autoQuizPaper') ? '★开' : '关');
    }
    function renderTopBarDetail() {
        if (!topBarBodyEl) return;
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
        const logs = document.createElement('div');
        logs.className = 'gxb-tb-logs';
        const last = logRing.slice(-5);
        const lines = last.length ? last : ['（暂无日志）'];
        for (const line of lines) {
            const ld = document.createElement('div');
            ld.className = 'gxb-tb-log';
            ld.textContent = line;
            ld.title = line;
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
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (act === 'pause') setPaused(!paused);
            else if (act === 'min') toggleTopBarMin();
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
            applyTopBarPos(currentTopBarPos(), false);
        }
        log('顶部面板已' + (topBarMin ? '最小化' : '展开'));
        renderTopBar();
    }
    let topBarView = 'status';
    let settingsBuilt = false;
    let topBarCfgActEl = null;
    let topBarTestResultEl = null;
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
    function onPanelChange(t) {
        if (!t || !t.getAttribute) return;
        if (t.getAttribute('data-gxb-preset')) {
            const id = t.value;
            const p = API_PRESETS.filter((x) => x.id === id)[0];
            if (!p) { GM_setValue('apiPreset', ''); return; }
            GM_setValue('apiPreset', p.id);
            GM_setValue('apiUrl', p.url);
            if (p.model) GM_setValue('model', p.model);
            setPanelInput('apiUrl', p.url);
            if (p.model) setPanelInput('model', p.model);
            log('已应用服务商预设：' + p.name);
            setPanelResult('已填入：' + p.url + '\n还需要填 API Key，然后点「测试 AI 连接」。');
            return;
        }
        const key = t.getAttribute('data-gxb-cfg');
        if (!key) return;
        if (t.type === 'checkbox') {
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
        await testApiConnection({ say: (m) => setPanelResult(m) });
    }
    function setTopBarView(v) {
        topBarView = v;
        settingsBuilt = false;
        if (topBarCfgActEl) topBarCfgActEl.textContent = (v === 'settings' ? '返回' : '设置');
        if (topBarBodyEl) topBarBodyEl.textContent = '';
        renderTopBarDetail();
        if (topBarEl) applyTopBarPos(topBarPos, topBarPos === null);
    }
    function currentTopBarPos() {
        if (!topBarEl) return null;
        const l = parseFloat(topBarEl.style.left);
        const t = parseFloat(topBarEl.style.top);
        if (isNaN(l) || isNaN(t)) return null;
        return { left: l, top: t };
    }
    function applyTopBarPos(pos, isInit) {
        if (!topBarEl) return;
        const w = topBarEl.offsetWidth;
        const h = topBarEl.offsetHeight;
        let left, top;
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
            left = pos.left;
            top = pos.top;
        } else if (isInit) {
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
            if (e.button !== undefined && e.button !== 0) return;
            const t = e.target;
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
                swallowClick = true;
                setTimeout(() => { swallowClick = false; }, 400);
                saveTopBarPos();
            }
            e.stopPropagation();
        };
        head.addEventListener('pointerdown', onDown, true);
        head.addEventListener('pointermove', onMove, true);
        head.addEventListener('pointerup', onUp, true);
        head.addEventListener('pointercancel', onUp, true);
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
        settingsBuilt = false;
        topBarTestResultEl = null;
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
        renderTopBarDetail();
    }
    function renderTopBar() {
        if (!cfg('showTopBar')) {
            if (topBarEl && document.body.contains(topBarEl)) topBarEl.remove();
            topBarEl = null;
            topBarBodyEl = null;
            topBarStatusEl = null;
            topBarPauseEl = null;
            return;
        }
        if (!document.body) return;
        if (!topBarEl || !document.body.contains(topBarEl)) {
            ensureTopBarStyle();
            buildTopBar();
        }
        const st = topBarStatusText();
        if (topBarStatusEl && topBarStatusEl.textContent !== st) {
            topBarStatusEl.textContent = st;
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
        if (!topBarDragging) applyTopBarPos(topBarPos, topBarPos === null);
    }
    window.addEventListener('resize', () => {
        if (topBarEl) applyTopBarPos(currentTopBarPos(), false);
    });
    (function wrapWarnForTopBar() {
        const orig = console.warn;
        console.warn = function (...a) {
            try {
                const s = a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ');
                if (s.indexOf('[高校邦助手]') >= 0) {
                    pushLogRing(s.replace(/\[高校邦助手\]\s*/g, '').trim());
                }
            } catch (e) {  }
            return orig.apply(console, a);
        };
    })();
    function getEditorBody() {
        const frame = q('#ueditor_0');
        try {
            return frame && frame.contentDocument ? frame.contentDocument.body : null;
        } catch (e) {
            return null;
        }
    }
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
    function submitReply() {
        const btn = q('.post-submit');
        if (visible(btn)) {
            btn.click();
            return true;
        }
        return false;
    }
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
    const LANG_CN = { zh: '中文', en: '英文', unknown: '未知' };
    function detectLang(text) {
        const s = String(text || '');
        const cjk = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
        const letters = (s.match(/[A-Za-z]/g) || []).length;
        if (!cjk && !letters) return 'unknown';
        if (!letters) return 'zh';
        if (!cjk) return 'en';
        return (cjk / (cjk + letters)) > 0.2 ? 'zh' : 'en';
    }
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
    function langMismatch(lang, reply) {
        const s = String(reply || '');
        const cjk = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
        const letters = (s.match(/[A-Za-z]/g) || []).length;
        if (lang === 'en') return cjk > 0;
        if (lang === 'zh') return cjk < 5 && letters > 20;
        return false;
    }
    const AI_MAX_TOKENS_LADDER = [500, 2000, 6000];
    const THINKING_DISABLED_BODY = { thinking: { type: 'disabled' } };
    const ADVICE_DISABLE_THINKING =
        '建议：① 本版已默认【关闭思考模式】（脚本会自动带上 thinking: disabled）；' +
        '② 若仍失败，去菜单里把「关闭思考模式」重新开一次再试（可能是页面缓存了旧脚本）；' +
        '③ 仍不行才考虑换模型 —— 换成 deepseek-chat（对话版）或 qwen-plus。';
    const ADVICE_SWITCH_MODEL = ADVICE_DISABLE_THINKING;
    const ADVICE_BIGGER_BUDGET =
        '建议：这次不是思考吃掉的额度。请在面板「设置」 把 max_tokens 调大，' +
        '或换一个上下文更长的模型。';
    function explainEmptyReply(d, raw, tried) {
        const choice = (d && d.choices && d.choices[0]) || null;
        const fr = (choice && choice.finish_reason) || '';
        const msg = (choice && choice.message) || {};
        const hasReasoning = !!(msg.reasoning_content || msg.reasoning);
        const out = ['返回内容为空（HTTP 200 通了，但正文取不到）'];
        if (fr === 'length') {
            out.push('原因：输出被 max_tokens 用完了（finish_reason=length）' +
                (hasReasoning ? ' —— 额度在【思考阶段】就被耗尽了' : ''));
            out.push(hasReasoning ? ADVICE_DISABLE_THINKING : ADVICE_BIGGER_BUDGET);
        } else if (fr === 'content_filter') {
            out.push('原因：被服务商的内容审核拦下了（finish_reason=content_filter）。换个模型或换个说法试试。');
        } else if (hasReasoning) {
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
    function parseAIReply(res) {
        if (res.status < 200 || res.status >= 300) {
            throw new Error('HTTP ' + res.status + ' ' + res.responseText.slice(0, 160));
        }
        let d;
        try {
            d = JSON.parse(res.responseText);
        } catch (e) {
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
            hasReasoning: !!(msg.reasoning_content || msg.reasoning),
            data: d,
            raw: res.responseText,
        };
    }
    function describeEmptyCause(r) {
        if (r.finishReason === 'length') return 'finish_reason=length（额度在思考阶段就用完了）';
        if (r.hasReasoning) return '模型给了 reasoning_content（思考内容）却没给正文';
        return 'finish_reason=' + (r.finishReason || '（空）');
    }
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
                    { role: 'system', content: cfg('systemPrompt') + (extraSystem || '') },
                    { role: 'user', content: userContent },
                ],
                temperature: 0.9,
                max_tokens: maxTokens,
                ...(cfg('disableThinking') ? THINKING_DISABLED_BODY : {}),
            }),
            timeout: 30000,
        });
        let r = null;
        const tried = [];
        for (let i = 0; i < AI_MAX_TOKENS_LADDER.length; i++) {
            r = parseAIReply(await send(AI_MAX_TOKENS_LADDER[i]));
            tried.push(AI_MAX_TOKENS_LADDER[i]);
            if (r.txt) break;
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
    function findMedia() {
        for (const sel of VIDEO_SELECTORS) {
            const el = q(sel);
            if (!el) continue;
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
    const hasVideo = () => {
        const m = findMedia();
        if (m) return true;
        return !!q('#video_player_html5_api') || !!q('.player-video video');
    };
    const hasAudio = () => {
        const m = findMedia();
        return !!m && m.tagName === 'AUDIO';
    };
    const isTopicPage = () => !!q('.topic-reply-container') && !q('.player-video');
    const KIND_CN = {
        video: '视频', audio: '音频', doc: '文档',
        quiz: '测验/考试', topic: '讨论', unknown: '未知类型',
    };
    const PAGE_KIND = {
        video: 'video',
        audio: 'audio',
        topic: 'topic',
        quiz: 'quiz',
        doc: 'doc',
        unknown: 'unknown',
    };
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
    function kindFromCatalog() {
        const cur = document.querySelector('a.chapter-info.curFilmPlay') ||
            document.querySelector('a.chapter-info.gxb-cur-point.curFilmPlay');
        if (!cur) return null;
        const t = (cur.getAttribute('content_type') || '').trim().toLowerCase();
        if (!t) return null;
        if (t === 'video') return PAGE_KIND.video;
        if (t === 'audio') return PAGE_KIND.audio;
        if (t === 'topic') return PAGE_KIND.topic;
        if (t === 'quiz' || t === 'assignment' || t === 'exam' || t === 'homework') {
            return PAGE_KIND.quiz;
        }
        if (t === 'courseware' || t === 'doc' || t === 'document' || t === 'text') {
            return PAGE_KIND.doc;
        }
        return null;
    }
    function pageScope() {
        const path = location.pathname;
        if (/\/quiz\/\d+/.test(path)) {
            return { run: true, why: '整卷测验页（自动答题）', hint: null };
        }
        if (/\/unit\/[^/]+\/chapter\/[^/]+/.test(path)) {
            return { run: true, why: '章节页（自动刷课）', hint: null };
        }
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
        if (isCatalogUrl()) {
            return { run: false, why: '课程目录', hint: '目录页 · 不自动跳章' };
        }
        return { run: true, why: '未识别的页面形态 → 按旧行为放行', hint: null };
    }
    let scopeHinted = '';
    function isCatalogUrl() {
        return /\/unit\/?$/.test(location.pathname);
    }
    function detectPageKind() {
        if (isTopicPage()) return PAGE_KIND.topic;
        if (hasAudio()) return PAGE_KIND.audio;
        if (hasVideo()) return PAGE_KIND.video;
        if (hasQuizContent()) return PAGE_KIND.quiz;
        const byCatalog = kindFromCatalog();
        if (byCatalog) return byCatalog;
        if (q('#chapterUnit, .chapter-unit-container, i.student-chapter-status, a.chapter-info')) {
            return PAGE_KIND.doc;
        }
        return PAGE_KIND.unknown;
    }
    let topicState = 'idle';
    const TOPIC_META_SEL = '.topic-author, .topic-subject, .remind-container, ' +
        '.topic-report, .has-more-info, .teach-essence';
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
            '.topic-detail', '.topic-content', '.topic-subject', '.topic-title',
            '.discuss-detail', '.topic-question', '.course-topic',
        ]) {
            const all = qa(sel);
            const el = all.find((e) => !e.querySelector(sel)) || all[0];
            if (!el) continue;
            const text = el.querySelector(TOPIC_META_SEL)
                ? textWithoutMeta(el)
                : el.innerText.trim();
            if (text) return text.slice(0, 1000);
        }
        const lines = (document.body.innerText || '')
            .split('\n').map((s) => s.trim()).filter((s) => s.length > 15);
        return lines.slice(0, 8).join('\n').slice(0, 1000) || '课程讨论';
    }
    function alreadyReplied() {
        return shown('.post-submit-edit') || shown('.post-submit-update');
    }
    let topicFailedReason = '';
    let topicDoneReason = '讨论已提交';
    const TOPIC_MAX_RETRY = 5;
    let topicRetry = 0;
    let topicHintLogged = false;
    function collectCopyableReplies() {
        const out = [];
        for (const el of document.querySelectorAll('#replies .reply-content')) {
            if (el.closest('.all-comments-container')) continue;
            const txt = (el.innerText || '').trim();
            if (!txt) continue;
            const box = el.closest('.reply-container');
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
    function pickReplyToCopy() {
        const all = collectCopyableReplies();
        if (!all.length) {
            return { ok: false, total: 0, reason: '这一页还没有任何人回复' };
        }
        const usable = all.filter((r) => r.len >= 30);
        const pool = (usable.length ? usable : all).slice().sort((a, b) => b.len - a.len);
        const top = pool.slice(0, 3);
        const picked = top[Math.floor(Math.random() * top.length)];
        return { ok: true, picked, total: all.length, candidates: pool.length };
    }
    async function handleTopicPage() {
        if (topicState !== 'idle') return;
        const mode = cfg('topicMode');
        if (mode === 'skip') {
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
        if (mode === 'api' && (!cfg('apiUrl') || !cfg('apiKey'))) {
            topicFailedReason = '尚未配置 AI 接口';
            topicState = 'failed';
            return;
        }
        topicState = 'working';
        try {
            for (let i = 0; i < 10 && !getEditorBody(); i++) await sleep(300);
            if (alreadyReplied()) {
                log('讨论已回复过，跳过');
                topicState = 'done';
                return;
            }
            let answer;
            try {
                if (mode === 'copy') {
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
                    const lang = detectLang(topic);
                    log('题目语言判定:', lang + '（' + LANG_CN[lang] + '）');
                    answer = await callAI('讨论话题：' + topic, langClause(lang));
                    if (langMismatch(lang, answer)) {
                        console.warn('[高校邦助手] 回复语言与题目不一致（题目=' + LANG_CN[lang] +
                            '），带更强指令重试一次…');
                        const retry = await callAI('讨论话题：' + topic,
                            langClause(lang) + '\n\n⚠️ 上一次的回复语言不对。这次务必严格遵守上面的语言要求。');
                        if (langMismatch(lang, retry)) {
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
                console.error('[高校邦助手] AI 生成失败，已停止提交（不会使用任何兜底答案）：' + err.message);
                console.warn('[高校邦助手] 请检查 API 配置（面板「设置」），或关掉「AI 自动回复讨论」让它跳过讨论页。');
                topicFailedReason = err.message || '未知错误';
                topicState = 'failed';
                return;
            }
            log('生成回复:', answer);
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
    const CHAPTER_ITEM_SELECTORS = [
        'li.lxy-chapter-li',
        '#chapterUnit ul.gxb-show > li',
        'li[class*="chapter-li"]',
        'i.student-chapter-status',
    ];
    const STATUS_DONE = 'gxb-icon-end';
    const STATUS_DOING = 'gxb-icon-ing';
    function chapterItems() {
        for (const sel of CHAPTER_ITEM_SELECTORS) {
            const els = qa(sel);
            if (!els.length) continue;
            return els
                .map((e) => (/student-chapter-status/.test(e.className || '')
                    ? (e.closest('li') || e.parentElement)
                    : e))
                .filter(Boolean);
        }
        return [];
    }
    function chapterStatusIcon(item) {
        if (!item) return null;
        const own = item.querySelector('i.student-chapter-status');
        if (own) return own;
        if (/student-chapter-status/.test(item.className || '')) return item;
        return null;
    }
    function isItemDone(item) {
        const icon = chapterStatusIcon(item);
        if (!icon) return false;
        const cls = String(icon.className || '');
        if (cls.includes(STATUS_DONE)) return true;
        const t = (item.innerText || '').replace(/\s/g, '');
        if (/已完成|已学完|已看完|已通过/.test(t)) return true;
        return false;
    }
    function isItemDoing(item) {
        const icon = chapterStatusIcon(item);
        if (!icon) return false;
        return String(icon.className || '').includes(STATUS_DOING);
    }
    function isItemLocked(item) {
        if (!item) return false;
        const a = item.querySelector('a.chapter-info') || item;
        const islock = String(a.getAttribute('islock') || '').toLowerCase();
        const isunlock = String(a.getAttribute('isunlock') || '').toLowerCase();
        if (islock === 'true') return true;
        if (isunlock === 'false') return true;
        const cls = String(item.className || '') + ' ' + String(a.className || '');
        if (/(^|[\s-])(is)?lock(ed)?([\s-]|$)/i.test(cls)) return true;
        if (item.querySelector('i[class*="lock"], .lock-icon, .icon-lock')) return true;
        return false;
    }
    function currentNodeItem() {
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
        const lit = qa('#chapterUnit a.chapter-info[style*="background"]')
            .find((a) => /background:\s*rgb/.test(a.getAttribute('style') || ''));
        if (lit) {
            const li = lit.closest('li');
            if (li) return li;
        }
        return null;
    }
    function readChapterProgress() {
        const items = chapterItems();
        if (!items.length) return null;
        const cur = currentNodeItem();
        if (!cur) return null;
        return isItemDone(cur);
    }
    let lastJump = null;
    function findNextChapter() {
        for (const sel of [
            'a.chapter-next.gxb-cur-point',
            '.chapter-next.gxb-cur-point',
            'a.chapter-next',
            '.chapter-next',
        ]) {
            const el = q(sel);
            if (el && visible(el)) return el;
        }
        try {
            const items = chapterItems();
            if (items.length) {
                const cur = currentNodeItem();
                const curIdx = cur ? items.indexOf(cur) : -1;
                if (curIdx >= 0 && curIdx + 1 < items.length) {
                    const a = items[curIdx + 1].querySelector('a.chapter-info');
                    if (a && visible(a)) return a;
                }
                for (const it of items) {
                    if (!isItemDone(it)) {
                        const a = it.querySelector('a.chapter-info');
                        if (a && visible(a)) return a;
                    }
                }
            }
        } catch (e) {
        }
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
        markLeave('me');
        next.click();
        return true;
    }
    function jumpSeemsStuck() {
        if (!lastJump) return false;
        return location.pathname === lastJump.from && Date.now() - lastJump.at > 3000;
    }
    function isWholePaperQuizPage() {
        const byUrl = /\/quiz\/\d+/.test(location.pathname);
        const qCount = document.querySelectorAll('.question-item, .examination-item').length;
        const submitAlways =
            !!document.querySelector('#quizSubmit') ||
            !!document.querySelector('.quiz-option .gxb-btn-pri') ||
            !!document.querySelector('#quizPaper .gxb-btn-pri');
        if (byUrl) return { whole: true, reason: 'URL 是 /quiz/<id>', qCount, submitAlways };
        if (qCount >= 2 && submitAlways) {
            return { whole: true, reason: '整卷已渲染（' + qCount + ' 题）+ 提交键常驻', qCount, submitAlways };
        }
        return { whole: false, reason: '题量 ' + qCount + '，提交键常驻=' + submitAlways, qCount, submitAlways };
    }
    let wholePaperHinted = false;
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
        updatePauseButtonHint('测验页 · 不自动作答', 1);
    }
    let quizObserver = null;
    let quizScanTimer = null;
    function attachQuizObserver() {
        if (!cfg('autoQuiz')) return;
        if (quizObserver) return;
        const observer = new MutationObserver(() => {
            if (quizScanTimer) return;
            quizScanTimer = setTimeout(() => {
                quizScanTimer = null;
                answerQuizIfPresent();
            }, 300);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        quizObserver = observer;
        log('答题监听已挂载（body 级）');
        answerQuizIfPresent();
    }
    const quizDone = new WeakSet();
    let quizAnsweredCount = 0;
    let quizBusy = false;
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
    const BTN_TEXT = {
        submit: ['交卷', '提交', '确定', '完成', 'submit'],
        player: ['继续播放', '继续学习', '继续', '播放', '关闭', 'player', 'close'],
        next: ['下一题', '下一页', 'next'],
    };
    function findByText(kind, root = document) {
        const wants = BTN_TEXT[kind] || [];
        if (!wants.length) return null;
        const cands = root.querySelectorAll('i, a, button, span, div[class*="btn"]');
        for (const el of cands) {
            if (el.offsetParent === null) continue;
            const t = (el.innerText || el.textContent || '').trim();
            if (!t || t.length > 8) continue;
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
    function findCurrentQuestion() {
        let questions = [];
        for (const sel of SEL.question) {
            const els = document.querySelectorAll(sel);
            if (els.length) { questions = [...els]; break; }
        }
        if (!questions.length) {
            const optEls = document.querySelectorAll('[answer_id], [data-answer-id]');
            const seen = new Set();
            optEls.forEach((o) => {
                let p = o.parentElement;
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
        if (!correctEl) return null;
        return { current, correctEl, total: questions.length };
    }
    function answerQuizIfPresent() {
        if (!cfg('autoQuiz')) return;
        if (quizBusy) return;
        const wholePaper = isWholePaperQuizPage();
        if (wholePaper.whole) {
            warnWholePaperQuizPage(wholePaper);
            return;
        }
        const found = findCurrentQuestion();
        if (!found) return;
        const { current, correctEl } = found;
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
            const nextBtn =
                pickOne(SEL.nextBtn, body) || pickOne(SEL.nextBtn) ||
                findByText('next', body) || findByText('next');
            if (nextBtn && visible(nextBtn)) {
                nextBtn.click();
                quizBusy = false;
                return;
            }
            const submitBtn =
                pickOne(SEL.submitBtn, body) || pickOne(SEL.submitBtn) ||
                findByText('submit', body) || findByText('submit');
            if (submitBtn) {
                submitBtn.click();
                quizDone.add(body);
                quizDone.add(current);
                quizSubmittedPaths.add(location.pathname);
                log('已自动作答并交卷，本次共答 ' + quizAnsweredCount + ' 题');
                quizAnsweredCount = 0;
                setTimeout(() => {
                    const playerBtn =
                        pickOne(SEL.playerBtn, body) || pickOne(SEL.playerBtn) ||
                        findByText('player', body) || findByText('player');
                    playerBtn && playerBtn.click();
                }, 1000);
            } else {
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
    function readQuizPaper() {
        const wraps = pickAll(['.answer-wap']);
        if (!wraps.length) return null;
        const questions = wraps.map((w, i) => {
            const type = w.getAttribute('question_type') || '';
            const qid = w.getAttribute('question_id') || '';
            const item = w.closest('.question-item') || w.parentElement || w;
            const titleEl = pickOne(['.quiz-title p', '.quiz-title'], item);
            const title = titleEl ? (titleEl.innerText || '').trim() : '';
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
        const answerable = questions.filter((q) => q.options.some((o) => o.kind === 'icon'));
        const blank = questions.filter((q) => q.type === 'fill_in_blank');
        return { questions, answerable, blankCount: blank.length };
    }
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
    function extractJson(txt) {
        if (!txt) return null;
        let t = String(txt).trim();
        t = t.replace(/^\x60\x60\x60(?:json)?/i, '').replace(/\x60\x60\x60$/i, '').trim();
        const a = t.indexOf('{');
        const b = t.lastIndexOf('}');
        if (a < 0 || b <= a) return null;
        try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
    }
    function validateAIAnswers(paper, parsed) {
        if (!parsed || !Array.isArray(parsed.answers)) {
            return { ok: false, why: 'AI 没有返回 {answers:[...]} 结构' };
        }
        const byQid = new Map();
        parsed.answers.forEach((a) => {
            if (a && a.question_id) byQid.set(String(a.question_id), a.answer_ids || a.answerIds || []);
        });
        const picked = [];
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
    function applyQuizAnswers(picked) {
        let clicked = 0;
        const failed = [];
        picked.forEach((p) => {
            let perQ = 0;
            p.els.forEach((el) => {
                if (!el.isConnected) return;
                const before = String(el.className || '');
                try {
                    el.click();
                } catch (e) {
                    return;
                }
                if (!el.isConnected) return;
                perQ++; clicked++;
                if (el.dataset) el.dataset.gxbClickedFrom = before;
            });
            if (!perQ) failed.push('第' + p.q.idx + '题');
        });
        return { clicked, failed };
    }
    async function readCheckedCount() {
        await new Promise((r) => setTimeout(r, 60));
        return document.querySelectorAll('.answer i.checked').length;
    }
    async function submitQuizPaper() {
        const btn = pickOne(['#quizSubmit', '.quiz-option .gxb-btn-pri']);
        if (!btn) return { ok: false, why: '找不到提交按钮 #quizSubmit' };
        btn.click();
        const SURE_SEL = [
            '.gxb-dialog-footer .gxb-sure', '.gxb-dialog-footer .gxb-btn-sure',
            '.gxb-sure', '.gxb-btn-sure',
        ];
        function findSure() {
            let el = pickOne(SURE_SEL);
            if (el) return el;
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
        for (let i = 0; i < 16 && !sure; i++) {
            await new Promise((r) => setTimeout(r, 200));
            sure = findSure();
        }
        if (!sure) return { ok: false, why: '点了提交后等了 3.2 秒，仍没等到确认弹窗的「确认」按钮（若页面上确实弹了框，请手动点一次「确认」）' };
        sure.click();
        return { ok: true };
    }
    let paperState = 'idle';
    let paperReason = '';
    function paperAlreadyHandled() {
        return paperState === 'working' || paperState === 'done' || paperState === 'failed';
    }
    const paperHandledPaths = new Set();
    function resetPaperReasonSeen() { paperReasonSeen = false; }
    async function handleWholePaperQuiz() {
        if (!cfg('autoQuizPaper')) return;
        if (paperAlreadyHandled()) return;
        const path = location.pathname;
        if (paperHandledPaths.has(path)) return;
        const info = isWholePaperQuizPage();
        if (!info.whole) return;
        if (readSubmittedState()) {
            paperState = 'done';
            paperHandledPaths.add(path);
            return;
        }
        paperState = 'working';
        resetPaperReasonSeen();
        try {
            const paper = readQuizPaper();
            if (!paper || !paper.answerable.length) {
                paperState = 'failed';
                paperReason = '读不到题目（页面上有 ' + (paper ? paper.questions.length : 0) +
                    ' 个答案区，但没有一个含可点的选项）';
                paperHandledPaths.add(path);
                warnPaper(paperReason);
                return;
            }
            const attempt = readAttemptsText();
            log('整卷测验：共 ' + paper.questions.length + ' 题，其中可自动作答 ' +
                paper.answerable.length + ' 题' +
                (paper.blankCount ? '（含 ' + paper.blankCount + ' 题填空题，需手动作答）' : '') +
                (attempt ? '；' + attempt : ''));
            if (attempt && /还有\s*1\s*次/.test(attempt)) {
                console.warn('[高校邦助手] ⚠️⚠️ 本套测验【只剩 1 次机会】，AI 一旦答错就没有第二次。' +
                    '\n如果你想自己手动做，请立刻点右下角暂停键，或关掉面板「设置」「测验自动作答」。');
            }
            updatePauseButtonHint('AI 作答中…', 2);
            const prompt = buildQuizPrompt(paper);
            let reply;
            try {
                reply = await callAI(prompt, QUIZ_EXTRA_SYSTEM);
            } catch (e) {
                paperState = 'failed';
                paperReason = 'AI 调用失败：' + (e && e.message ? e.message : String(e));
                paperHandledPaths.add(path);
                warnPaper(paperReason);
                return;
            }
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
            const applied = applyQuizAnswers(v.picked);
            const checkedNow = await readCheckedCount();
            log('整卷测验：已点选 ' + applied.clicked + ' 项，覆盖 ' + v.picked.length + ' 题' +
                '；页面上实测选中 ' + checkedNow + ' 项' +
                (applied.failed.length ? '；未点中：' + applied.failed.join('、') : ''));
            if (applied.failed.length) {
                paperState = 'failed';
                paperReason = '有 ' + applied.failed.length + ' 题的选项没能点中（' +
                    applied.failed.join('、') + '）。已【停止，不交卷】—— 请手动完成后再自行提交。';
                paperHandledPaths.add(path);
                warnPaper(paperReason);
                return;
            }
            if (paper.blankCount) {
                console.warn('[高校邦助手] 本套有 ' + paper.blankCount +
                    ' 题填空题，脚本【不会填】（站点自己的提交逻辑也不收集填空题答案）。' +
                    '建议：这些题留空交卷会扣分，若你在意就先手动填上再交。');
            }
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
            const _msg = (e && e.message ? e.message : String(e));
            try {
                paperState = 'failed';
                paperReason = '异常：' + _msg;
                paperHandledPaths.add(location.pathname);
            } catch (_e2) {  }
            try { warnPaper('异常：' + _msg); } catch (_e3) {  }
            console.error('[高校邦助手] 整卷测验异常：', e);
        }
    }
    let paperReasonFull = '';
    let paperReasonSeen = false;
    function briefPaperAction(reason) {
        const t = String(reason || '');
        if (/内容审核|content_filter/.test(t)) return '被内容审核拦了：换个说法或模型';
        if (/不是合法 JSON|流式/.test(t)) {
            return '地址要填到 /chat/completions';
        }
        if (/HTTP 40[13]/.test(t)) return 'Key 或用不了：见面板「设置」的测试结果';
        if (/model not found|HTTP 404/.test(t)) return '模型名不对：见面板「设置」的测试结果';
        if (/推理模型|max_tokens|reasoning_content|返回内容为空|思考/.test(t)) {
            return '已自动关思考：仍失败请重开一下';
        }
        let brief = t.split('\n')[0].replace(/\s+/g, ' ').trim();
        if (brief.length > 18) brief = brief.slice(0, 17) + '…';
        return brief || '原因见按钮详情';
    }
    function warnPaper(reason) {
        console.warn('[高校邦助手] 【整卷测验·未自动作答】' + reason);
        paperReasonFull = String(reason || '');
        updatePauseButtonHint('需手动：' + briefPaperAction(reason) + '（点这里看详情）', 2);
    }
    function readAttemptsText() {
        const hits = [...document.querySelectorAll('body *')]
            .filter((e) => e.children.length === 0 && /还有\s*\d+\s*次|有效提交次数/.test(e.innerText || ''));
        return hits.length ? (hits[0].innerText || '').trim().replace(/\s+/g, ' ') : '';
    }
    function isVisibleEl(el) {
        if (!el) return false;
        if (el.offsetParent !== null) return true;
        try {
            return el.getClientRects().length > 0;
        } catch (e) {
            return false;
        }
    }
    function readSubmittedState() {
        if (!/\/quiz\/\d+/.test(location.pathname)) return null;
        const why = [];
        const subBox = pickOne(['.quiz-submission-bg', '.quiz-sub-more', '.quiz-sub-finish']);
        const subBoxShown = isVisibleEl(subBox);
        if (subBoxShown) why.push('页面上有成绩区块（' + (subBox.className || '').split(/\s+/)[0] + '）');
        const inlineText = [...document.querySelectorAll('script:not([src])')]
            .map((s) => s.textContent || '').join('\n');
        if (/"status"\s*:\s*"submitted"/.test(inlineText)) {
            why.push('页面内联数据里 status=submitted');
        }
        const marked = document.querySelectorAll(
            '.answer i.true, .answer i.error, .gxb-icon-radio.true, .gxb-icon-radio.error,' +
            ' .gxb-icon-check.true, .gxb-icon-check.error').length;
        const submitBtn = pickOne(['#quizSubmit', '.quiz-option .gxb-btn-pri']);
        const again = submitBtn
            ? null
            : pickOne(['.quiz-sub-again', '.quiz-sub-see', '.quiz-sub-detail']);
        const submitted =
            subBoxShown ||
            /"status"\s*:\s*"submitted"/.test(inlineText) ||
            (marked > 0 && !submitBtn) ||
            (isVisibleEl(again) && !submitBtn);
        if (!submitted) return null;
        const out = {
            score: null, fullScore: null, right: null, wrong: null,
            answered: 0, attemptsLeft: null, submittedAt: null, why: why.join('；'),
        };
        const scoreBox = pickOne(['.quiz-sub-more', '.quiz-submission-bg', '.score-publish']);
        const scoreText = isVisibleEl(scoreBox)
            ? String(scoreBox.innerText || '').replace(/\s+/g, ' ') : '';
        const mScore = /本次得分\s*([\d.]+)\s*分/.exec(scoreText) ||
                       /得分\s*([\d.]+)\s*分/.exec(scoreText);
        if (mScore) out.score = mScore[1];
        const mFull = /满分\s*([\d.]+)\s*分/.exec(scoreText);
        if (mFull) out.fullScore = mFull[1];
        const mLeft = /还有\s*(\d+)\s*次/.exec(scoreText) ||
                      /还有\s*(\d+)\s*次/.exec(document.body.innerText || '');
        if (mLeft) out.attemptsLeft = mLeft[1];
        const timeBox = pickOne(['.quiz-sub-finish']);
        const timeText = timeBox ? String(timeBox.innerText || '').trim() : '';
        const mTime = /提交时间\s*[:：]?\s*([0-9\-:\s]+)/.exec(timeText);
        if (mTime) out.submittedAt = mTime[1].trim();
        const R = document.querySelectorAll('.answer i.true, .answer i.gxb-icon-radio.true,' +
            ' .answer i.gxb-icon-check.true').length;
        const W = document.querySelectorAll('.answer i.error, .answer i.gxb-icon-radio.error,' +
            ' .answer i.gxb-icon-check.error').length;
        out.right = R;
        out.wrong = W;
        out.answered = document.querySelectorAll('.answer-wap').length;
        return out;
    }
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
    function reportSubmissionResult() {
        const isResultPage = /\/quiz\/\d+\/submission\//.test(location.pathname);
        const path = location.pathname;
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
        const st = readSubmittedState();
        if (!st) return;
        if (submittedStatePaths.has(path)) return;
        submittedStatePaths.add(path);
        const bar = formatSubmittedBar(st);
        const quizId = (path.match(/\/quiz\/(\d+)/) || [])[1] || '';
        log('测验已完成（本页为答题页·已提交形态）：' + bar +
            (quizId ? '；测验编号 ' + quizId : ''));
        updatePauseButtonHint('已完成 · ' + bar + '（点这里看详情）', 2);
        submittedDetail = formatSubmittedDetail(st, quizId);
        submittedDetailSeen = false;
    }
    const submittedStatePaths = new Set();
    const resultReportedPaths = new Set();
    let submittedDetail = '';
    let submittedDetailSeen = false;
    const muteVideo = (v) => {
        if (!v || !cfg('autoVideo')) return;
        try {
            if (v.volume !== 0) v.volume = 0;
            if (!v.muted) v.muted = true;
        } catch (e) {}
    };
    function armInstantMute(v) {
        if (!v || v.__gxbMuteArmed) return;
        v.__gxbMuteArmed = true;
        muteVideo(v);
        ['play', 'playing', 'loadedmetadata', 'volumechange', 'canplay'].forEach((ev) => {
            v.addEventListener(ev, () => muteVideo(v), true);
        });
    }
    function installInstantMute() {
        if (!cfg('autoVideo')) return;
        if (window.__gxbMuteInstalled) return;
        window.__gxbMuteInstalled = true;
        const scan = () => {
            qa('video, audio').forEach(armInstantMute);
        };
        scan();
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
            mo.observe(document.body || document.documentElement, {
                childList: true, subtree: true,
            });
        } catch (e) {}
    }
    function handleVideoPage() {
        const video = q('#video_player_html5_api') || q('video');
        if (video && !video.__gxbPauseHooked) {
            video.__gxbPauseHooked = true;
            const markUser = () => { video.__gxbUserPaused = true; };
            video.addEventListener('click', () => {
                if (!video.paused) markUser();
                else video.__gxbUserPaused = false;
            });
            video.addEventListener('play', () => { video.__gxbUserPaused = false; });
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && document.activeElement === video) markUser();
            });
        }
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
    }
    function checkIsLastChapter() {
        const items = chapterItems();
        if (!items.length) return null;
        const cur = currentNodeItem();
        if (!cur) return null;
        const curIdx = items.indexOf(cur);
        if (curIdx < 0) return null;
        let hasNext = false;
        for (let i = curIdx + 1; i < items.length; i++) {
            const a = items[i].querySelector('a.chapter-info');
            if (!a) continue;
            if (isItemLocked(items[i])) continue;
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
    function isSkipInstantlyKind(kind) {
        if (!cfg('skipNonVideo')) return false;
        if (kind === PAGE_KIND.video) return false;
        if (kind === PAGE_KIND.audio) return false;
        if (kind === PAGE_KIND.topic) return false;
        if (kind === PAGE_KIND.doc) return false;
        if (kind === PAGE_KIND.quiz && cfg('quizChapterMode') === 'answer') return false;
        return true;
    }
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
    const MEDIA_PERCENT_SELECTORS = [
        '.video-percent', '.audio-percent',
        '.videoPercent', '.player-percent',
        '[class*="video-percent"]', '[class*="audio-percent"]',
    ];
    function isCatalogOwnedPercent(el) {
        try {
            return !!(el.closest('#chapterUnit') ||
                el.closest('.chapter-unit-container') ||
                el.closest('.unit-list') ||
                el.closest('li.lxy-chapter-li'));
        } catch (e) { return false; }
    }
    function readPercentText() {
        const seen = new Set();
        for (const sel of MEDIA_PERCENT_SELECTORS) {
            for (const el of qa(sel)) {
                if (seen.has(el)) continue;
                seen.add(el);
                const raw = (el.innerText || el.textContent || '').trim();
                if (!raw) continue;
                const n = parseFloat(raw.replace('%', '').trim());
                if (!isFinite(n)) continue;
                if (isCatalogOwnedPercent(el)) continue;
                return { n, raw, sel };
            }
        }
        return null;
    }
    function readMediaProgress(media) {
        const m = media || findMedia();
        const cur = m ? (Number(m.currentTime) || 0) : 0;
        const dur = m ? Number(m.duration) : NaN;
        const hasDur = !!dur && isFinite(dur) && dur > 0;
        const localPercent = hasDur ? (cur / dur) * 100 : -1;
        const pct = readPercentText();
        const catalog = readCatalogState();
        if (catalog === 'doing') {
            return {
                done: false,
                reason: '目录显示「进行中」（未刷完）',
                cur, dur, percent: pct ? pct.n : localPercent, catalog,
            };
        }
        if (pct && pct.n >= 100) {
            return { done: true, reason: '平台进度条 ' + pct.raw, cur, dur, percent: pct.n, catalog };
        }
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
        if (m && m.ended) {
            return { done: true, reason: '播放器已 ended', cur, dur, percent: localPercent, catalog };
        }
        if (hasDur && cur > dur - 0.5) {
            return {
                done: true,
                reason: '播放进度到片尾 ' + cur.toFixed(1) + '/' + dur.toFixed(1),
                cur, dur, percent: localPercent, catalog,
            };
        }
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
        if (kind === PAGE_KIND.video || kind === PAGE_KIND.audio) {
            const mp = readMediaProgress();
            if (mp.done) {
                return { settled: true, reason: kind + ' ' + mp.reason };
            }
            return { settled: false, reason: kind + ' ' + mp.reason };
        }
        const catalog = readCatalogState();
        if (catalog === 'doing') {
            return { settled: false, reason: '目录显示「进行中」（未刷完）' };
        }
        const byCatalog = readChapterProgress();
        if (byCatalog === true) return { settled: true, reason: '目录显示本章已完成' };
        if (kind === PAGE_KIND.quiz) {
            if (quizSubmittedHere) return { settled: true, reason: '本章测验已交卷' };
            return { settled: false, reason: '测验尚未交卷' };
        }
        if (kind === PAGE_KIND.topic) {
            if (topicState === 'done') return { settled: true, reason: topicDoneReason };
            if (topicState === 'failed') return { settled: false, reason: '讨论未提交（已停等人工处理）' };
            return { settled: false, reason: '讨论未提交（处理中）' };
        }
        return { settled: false, reason: '无进度信号，等时间窗' };
    }
    function ask(label, key, secret) {
        const v = prompt(label, secret ? '' : cfg(key));
        if (v !== null && v.trim() !== '') GM_setValue(key, v.trim());
    }
    function toggle(key, label) {
        const next = !cfg(key);
        GM_setValue(key, next);
        alert(label + '已' + (next ? '开启' : '关闭') + '\n刷新页面生效');
    }
    function toggleQuizChapterMode() {
        const next = cfg('quizChapterMode') === 'answer' ? 'skip' : 'answer';
        if (next === 'answer' && !cfg('autoQuiz')) {
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
    function buildQuizProbePrompt() {
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
    const QUIZ_EXTRA_SYSTEM =
        '\n\n你正在做一份计分测验，答错会扣分且机会有限。' +
        '请务必认真作答，宁可根据常识和语言理解推理，也不要空着。' +
        '只输出要求的 JSON，不要任何其他文字。';
    async function testApiConnection(sink) {
        const say = (sink && typeof sink.say === 'function') ? sink.say : (m) => alert(m);
        if (!cfg('apiUrl') || !cfg('apiKey')) {
            say('还没配好：地址或 Key 是空的。\n在面板「设置」里选服务商、填 API Key。');
            return;
        }
        const model = cfg('model');
        console.log('[高校邦助手] 测试 AI 连接… 地址=' + cfg('apiUrl') + '  模型=' + model);
        console.log('[高校邦助手] 第 1 步：短问题（验证地址/Key/模型名通不通）…');
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
    GM_registerMenuCommand('① 打开设置面板（顶部）', () => {
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
    void chooseApiPreset; void ask; void toggle; void toggleQuizChapterMode; void chooseTopicMode;
    const pageEnteredAt = new Map();
    let lastPath = location.pathname;
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
    const selfCheckMsgs = [];
    function showSelfCheckHint(key, text) {
        const i = selfCheckMsgs.findIndex((m) => m.key === key);
        if (i >= 0) {
            if (selfCheckMsgs[i].text === text) return;
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
        if (multiInstanceWarned) return;
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
    function chapterKey() {
        const p = (location.pathname.match(/\/chapter\/(\d+)/) || [])[1] || '';
        const h = (location.hash.match(/chapterId=(\d+)/) || [])[1] || '';
        return p + '/' + h;
    }
    const SELFNAV_KEY = 'gxb-helper:selfnav';
    let navRec = null;
    let foreignNavCount = 0;
    function writeNavRec(chapter, leftBy) {
        try {
            sessionStorage.setItem(SELFNAV_KEY,
                JSON.stringify({ chapter: chapter, leftBy: leftBy, at: Date.now() }));
        } catch (e) {
        }
    }
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
    const isChapterKey = (k) => /\d/.test(String(k || ''));
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
    document.addEventListener('click', (e) => {
        const t = e.target;
        const a = t && t.closest ? t.closest('a') : null;
        if (a) markLeave('user');
    }, true);
    let catalogHinted = false;
    setInterval(() => {
        const kind = detectPageKind();
        renderPauseButton();
        renderTopBar();
        installInstantMute();
        checkMultiInstance();
        checkNavAttribution();
        if (isPaused()) {
            updatePauseButtonHint('已暂停 · 点击继续');
            return;
        }
        handleWholePaperQuiz();
        reportSubmissionResult();
        if (pinnedHint > 0 && !isCatalogUrl() && !isWholePaperQuizPage().whole) {
            pinnedHint = 0;
        }
        const _scope = pageScope();
        if (!_scope.run) {
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
        if (isCatalogUrl()) {
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
        const quizChapterIsSkipped =
            kind === PAGE_KIND.quiz && cfg('skipNonVideo') && cfg('quizChapterMode') === 'skip';
        if (!quizChapterIsSkipped) attachQuizObserver();
        const settled = isChapterSettled(kind);
        if (!allDone) {
            const last = checkIsLastChapter();
            if (last) {
                finishedHere = last.isLast;
                if (!paused && last.total > 1) {
                    updatePauseButtonHint('运行中 ' + (last.index + 1) + '/' + last.total);
                }
            }
        }
        if (allDone) {
            return;
        }
        if (kind === PAGE_KIND.topic) {
            handleTopicPage();
            maybeAdvance(kind, settled);
            return;
        }
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
            if (kind === PAGE_KIND.quiz) handleQuizPageGating();
        }
        maybeAdvance(kind, settled);
    }, 1000);
    const mediaWaitHinted = new Set();
    function maybeAdvance(kind, settled) {
        if (allDone) {
            return;
        }
        if (finishedHere) {
            if (settled.settled) {
                declareAllDone(kind);
                return;
            }
        }
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
            return;
        }
        if (!cfg('autoNext')) return;
        if (!cfg('skipNonVideo') && kind !== PAGE_KIND.video && kind !== PAGE_KIND.audio) return;
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
        if (settled.settled) {
            if (jumpSeemsStuck()) {
                log('上一章跳转似乎未生效，重试一次');
                lastJump = null;
            }
            log('本章已完成（' + settled.reason + '），跳下一章');
            pageEnteredAt.set(location.pathname, Number.MAX_SAFE_INTEGER);
            hideStuckHint();
            goNext();
            return;
        }
        if (kind === PAGE_KIND.topic) return;
        if (isSkipInstantlyKind(kind)) {
            if (finishedHere) {
                return;
            }
            const next = findNextChapter();
            if (!next) {
                if (!allDone) log('本页（' + kind + '）无下一章可跳，保持不动');
                return;
            }
            log('本页是' + (KIND_CN[kind] || kind) + '，按设置直接跳过');
            pageEnteredAt.set(location.pathname, Number.MAX_SAFE_INTEGER);
            hideStuckHint();
            goNext();
            return;
        }
        if (kind === PAGE_KIND.quiz && cfg('quizChapterMode') === 'answer' && stayed < grace * 3) {
            return;
        }
        if (kind === PAGE_KIND.quiz && cfg('quizChapterMode') === 'answer' && stayed >= grace * 3) {
            console.warn(
                '[高校邦助手] 测验 / 作业页已等待 ' + Math.round((grace * 3) / 1000) +
                's 仍未交卷，超时跳过本章。\n' +
                '  若本章题目没答完，可能是：① 正确答案没在页面 DOM 里（脚本读不到就没法答）；\n' +
                '  ② 题目太多或加载太慢。可把面板「设置」 改回「跳过」，或手动完成本章。'
            );
        }
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
    let allDone = false;
    let finishedHere = false;
    function declareAllDone(kind) {
        allDone = true;
        hideStuckHint();
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
        showDoneHint(msg);
        console.log('[高校邦助手] ' + msg.replace(/\n+/g, ' '));
    }
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
    let quizSubmittedHere = false;
    function handleQuizPageGating() {
        if (!quizSubmittedHere && quizSubmittedPaths.has(location.pathname)) {
            quizSubmittedHere = true;
        }
    }
    const quizSubmittedPaths = new Set();
    if (!cfg('apiUrl')) {
        setTimeout(() => {
            if (confirm('检测到尚未配置 AI 接口。\n\n未配置时，讨论页【不会自动提交任何内容】（避免发出与题目无关的回复）。\n视频播放、自动跳章、自动答题不受影响。\n\n现在配置？（之后可在篡改猴菜单里随时配置）')) {
                chooseApiPreset();
                ask('API Key（保存在浏览器本地，不会写进源码）', 'apiKey', true);
            }
        }, 2500);
    }
    pushLogRing('v' + SCRIPT_VERSION + ' 已加载');
    renderTopBar();
    console.log(
        '[高校邦助手] v' + SCRIPT_VERSION + ' 已加载 · AI 返回空内容时可诊断 + 按额度阶梯重试 · ' +
        '顶部可拖动/可最小化的控制面板（含最近日志，不用开 F12）· ' +
        '页面暂停（刷新后仍有效）+ 测验/作业章独立开关（默认跳过）· ' +
        '讨论题三选一（跳过/抄答案/接入API）+ 服务商预设 + 测试连接 + 回复语言自动跟随题目 · ' +
        '运行环境自检：多版本共存 / 跨页面抢跳会直接在页面上告警 · ' +
        '配置全部在顶部面板的「设置」里（菜单只留面板相关）'
    );
    if (paused) {
        console.warn(
            '[高校邦助手] ⏸ 已恢复「暂停」状态（你在本标签页按过暂停，刷新 / 切章后仍然有效）。\n' +
            '  当前【不跳章、不答题、不回复讨论】。\n' +
            '  恢复运行：点右下角红色按钮「▶ 已暂停 · 点击继续」。'
        );
    }
})();
