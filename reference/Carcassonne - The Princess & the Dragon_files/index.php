<!doctype html><html lang="ru"><head><title>Проверяем, что вы не бот!</title><link rel="stylesheet" href="/.within.website/x/xess/xess.min.css?cachebuster=v1.28.1"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex,nofollow"><style>
        body,
        html {
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-left: auto;
            margin-right: auto;
        }

        .centered-div {
            text-align: center;
        }

        #status {
            font-variant-numeric: tabular-nums;
        }

        #progress {
            display: none;
            width: 90%;
            width: min(20rem, 90%);
            height: 2rem;
            border-radius: 1rem;
            overflow: hidden;
            margin: 1rem 0 2rem;
            outline-offset: 2px;
            outline: #b16286 solid 4px;
        }

        .bar-inner {
            background-color: #b16286;
            height: 100%;
            width: 0;
            transition: width 0.25s ease-in;
        }
    	</style><script id="anubis_version" type="application/json">"v1.28.1"
</script><script id="anubis_challenge" type="application/json">{"rules":{"algorithm":"fast","difficulty":2},"challenge":{"issuedAt":"2026-11-02T08:24:49.080636961Z","metadata":{"Referer":"https://wikicarpedia.com/","User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36","X-Real-IP":"109.169.220.156"},"id":"01a19b5c-70b8-7969-b610-f7b08298485d","method":"fast","randomData":"5d34d6ae722fec07c7f14c1689620dd4a55644ee90b29c5e6f5bc7884ad5e018f84d1063ba8eb3e40ac74a01b3d5677b5e4f5e026a142e4d302fb9fe0189e408","policyRuleHash":"8a70f4a00fe5d250","difficulty":2,"spent":false,"extensions":null}}
</script><script id="anubis_base_prefix" type="application/json">""
</script><script id="anubis_public_url" type="application/json">""
</script></head><body id="top"><script type="ignore"><a href="/.within.website/x/cmd/anubis/api/honeypot/8bfcab69-cf53-4e3e-b096-b4070e6993c7/init">Don't click me</a></script><main><h1 id="title" class="centered-div">Проверяем, что вы не бот!</h1><div class="centered-div"><img id="image" style="width:100%;max-width:256px;" src="/.within.website/x/cmd/anubis/static/img/pensive.webp?cacheBuster=v1.28.1"> <img style="display:none;" style="width:100%;max-width:256px;" src="/.within.website/x/cmd/anubis/static/img/happy.webp?cacheBuster=v1.28.1"><p id="status">Загрузка...</p><p id="anubis-script-error" style="display:none;">Anubis не смог загрузить свой JavaScript. Возможно, сервер перегружен. Пожалуйста, перезагрузите страницу, чтобы попробовать снова.</p><script id="anubis-main" defer type="module" src="/.within.website/x/cmd/anubis/static/js/main.mjs?cacheBuster=v1.28.1"></script><script>/*
@licstart  The following is the entire license notice for the
JavaScript code in this page.

Copyright (c) 2026 Xe Iaso <xe.iaso@techaro.lol>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@licend  The above is the entire license notice
for the JavaScript code in this page.

## Rationale

This script catches `main.mjs` failing to load and re-injects it with
jittered exponential backoff.

Without this any failures loading `main.mjs` leaves the challenge page
sitting on the "Loading..." message forever with no error messaging
outside of the browser console, which is unavailable on mobile browsers.

Disable loading this script at your peril. You have been warned.
*/
(()=>{var f=(e,t=750,n=1e4)=>Math.random()*Math.min(n,t*Math.pow(e,2));var d=(e,t={},n=[])=>{let s=typeof e=="function"?e(t):Object.assign(document.createElement(e),t);return Array.isArray(n)||(n=[n]),s.append(...n),s};var i=e=>document.getElementById(e);var _=e=>e.map(i);(()=>{let e=i("anubis-main");if(!e){console.debug("can't find anubis main.mjs element via ID `anubis-main`, bailing");return}let t=e.getAttribute("src");if(!t){console.debug("can't find src attribute of script element `anubis-main`, bailing");return}let n=t.indexOf("?")===-1?"?":"&",s=4,E=750,A=1e4,c=1e4,a=0,l=0,u=()=>window.__anubisBooted===!0,p=()=>{let r=_(["anubis-script-error","status","progress"]);if(r.filter(D=>D==null).length!==0){console.debug("missing one of the following elements: anubis-script-error, status, progress. cannot proceed, bailing.");return}let[o,M,T]=r;o.style.display="block",M.style.display="none",T.style.display="none"},m=r=>()=>{if(u()||r!==l)return;if(l++,a++,a>s){p();return}let o=f(a,E,A);setTimeout(y,o)},y=()=>{if(u())return;let r=m(l),o=d("script",{async:!0,type:"module",src:t+n+"anubisRetry="+a,onerror:r});document.head.appendChild(o),setTimeout(r,c)},b=m(0);e.onerror=b,setTimeout(b,c)})();})();
</script><div id="progress" role="progressbar" aria-labelledby="status"><div class="bar-inner"></div></div><details><p>Это мера против ботов и вредоносных запросов, аналогичная CAPTCHA. Однако вместо того, чтобы вам приходилось работать самостоятельно, вашему браузеру дается задача вычисления, которую он должен решить, чтобы убедиться, что он является действительным клиентом. Эта концепция называется <a href="https://en.wikipedia.org/wiki/Proof_of_work">Доказательство выполнения работы</a>. Задача рассчитывается за несколько секунд, и вам предоставляется доступ к веб-сайту. Спасибо за понимание и терпение.</p><p>Anubis требует использования современных функций JavaScript, которые плагины, по типу JShelter, отключают. Пожалуйста, отключите JShelter и другие подобные плагины для этого домена.</p></details><noscript><p>К сожалению, для решения этой проверки необходимо включить JavaScript. Это необходимо, поскольку компании, занимающиеся разработкой ИИ, изменили моральные правила, касающийся хостинга веб-сайтов. Решение без использования JavaScript находится в стадии разработки.</p></noscript><div id="testarea"></div></div><footer><div class="centered-div"><p>Защищено <a href="https://github.com/TecharoHQ/anubis">Anubis</a> От <a href="https://techaro.lol">Techaro</a>. Сделано с ❤️ из 🇨🇦.</p><p>Дизайн маскота от <a href="https://bsky.app/profile/celphase.bsky.social">CELPHASE</a>.</p><p>На сайте запущен Anubis версии <code>v1.28.1</code>.</p></div></footer></main></body></html>