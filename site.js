/* Site chrome: language selector, high-contrast toggle, mobile menu, search. */
(function(){
var root=document.documentElement;
function $(s,c){return (c||document).querySelector(s);}
function $$(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));}
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}

/* ---- Utility bar scroll-away ---- */
// Read scroll position inside requestAnimationFrame so it never forces an early layout.
var scrolled=null,ticking=false;
function onScroll(){
  if(ticking)return;ticking=true;
  requestAnimationFrame(function(){
    ticking=false;var now=window.scrollY>=36;
    if(now!==scrolled){scrolled=now;root.classList.toggle('ub-scrolled',now);}
  });
}
window.addEventListener('scroll',onScroll,{passive:true});onScroll();

/* ---- High contrast ---- */
var hcToggles=$$('[data-hc-toggle]');
function setHC(on,save){
  root.classList.toggle('hc',on);
  hcToggles.forEach(function(t){t.setAttribute('aria-checked',on?'true':'false');});
  if(save)store('wise-hc',on?'1':'0');
}
setHC(root.classList.contains('hc'),false);
hcToggles.forEach(function(t){t.addEventListener('click',function(){setHC(!root.classList.contains('hc'),true);});});

/* ---- Dark mode (saved as "theme", the same setting the Knowledge Hub uses) ---- */
var themeToggles=$$('[data-theme-toggle]');
function isDark(){return root.getAttribute('data-theme')==='dark';}
function setTheme(dark,save){
  if(dark)root.setAttribute('data-theme','dark');else root.removeAttribute('data-theme');
  themeToggles.forEach(function(t){t.setAttribute('aria-checked',dark?'true':'false');});
  if(save)store('theme',dark?'dark':'light');
}
setTheme(isDark(),false);
themeToggles.forEach(function(t){t.addEventListener('click',function(){setTheme(!isDark(),true);});});
if(window.matchMedia){
  var mq=matchMedia('(prefers-color-scheme: dark)');
  var follow=function(e){if(store('theme')===null)setTheme(e.matches,false);};
  if(mq.addEventListener)mq.addEventListener('change',follow);else if(mq.addListener)mq.addListener(follow);
}

/* ---- Language (Google Website Translator, loaded only when a language is chosen) ---- */
var langSelects=$$('[data-lang-select]');
function currentLang(){var m=document.cookie.match(/(?:^|;\s*)googtrans=\/[^\/;]*\/([^;]+)/);return m?decodeURIComponent(m[1]):'en';}
function writeLangCookie(lang){
  var val=lang==='en'?'':'/en/'+lang;
  var exp=lang==='en'?'; expires=Thu, 01 Jan 1970 00:00:00 GMT':'';
  document.cookie='googtrans='+val+'; path=/'+exp;
  var host=location.hostname;
  if(host.indexOf('.')>-1){
    var base=host.replace(/^www\./,'');
    document.cookie='googtrans='+val+'; path=/; domain=.'+base+exp;
    document.cookie='googtrans='+val+'; path=/; domain='+host+exp;
  }
}
var lang=currentLang();
langSelects.forEach(function(s){
  s.value=lang;if(s.value!==lang)s.value='en';
  s.addEventListener('change',function(){
    if(s.value!=='en'&&!allowed('translate')){
      if(!window.confirm('Translation is provided by an outside service that receives the page text and sets a cookie to remember your language. Turn on translation?')){s.value=currentLang();if(s.value!==currentLang())s.value='en';return;}
      var c=readConsent()||{};c.translate=true;saveConsent(c);
    }
    writeLangCookie(s.value);location.reload();
  });
});
if(lang!=='en'){
  var holder=document.createElement('div');holder.id='google_translate_element';document.body.appendChild(holder);
  window.wiseTranslateInit=function(){
    new google.translate.TranslateElement({pageLanguage:'en',autoDisplay:false},'google_translate_element');
  };
  var gt=document.createElement('script');
  gt.src='https://translate.google.com/translate_a/element.js?cb=wiseTranslateInit';gt.async=true;
  document.body.appendChild(gt);
}

/* ---- Give menu + membership link ---- */
// One place to change where membership buttons go. Keep visitors on our own giving page;
// the Donorbox checkout is reached only from the give.html form.
var MEMBERSHIP_URL='/give.html#membership';
$$('[data-membership-link]').forEach(function(a){a.href=MEMBERSHIP_URL;});
var giveBtn=$('[data-give-toggle]'),givePanel=$('#give-panel');
function setGive(open){
  if(!giveBtn||!givePanel)return;
  givePanel.hidden=!open;giveBtn.setAttribute('aria-expanded',open?'true':'false');
}
if(giveBtn&&givePanel){
  giveBtn.addEventListener('click',function(e){e.stopPropagation();setGive(givePanel.hidden);if(!givePanel.hidden){var f=$('a',givePanel);if(f)f.focus();}});
  document.addEventListener('click',function(e){if(!givePanel.hidden&&!givePanel.contains(e.target))setGive(false);});
  givePanel.addEventListener('keydown',function(e){if(e.key==='Escape'){setGive(false);giveBtn.focus();}});
  giveBtn.addEventListener('keydown',function(e){if(e.key==='Escape')setGive(false);});
  givePanel.addEventListener('focusout',function(e){if(!givePanel.contains(e.relatedTarget)&&e.relatedTarget!==giveBtn)setGive(false);});
}

/* ---- Lightweight YouTube embeds: load the player only when someone presses play ---- */
$$('[data-yt]').forEach(function(a){
  a.addEventListener('click',function(e){
    if(!allowed('video'))return; // videos not allowed: follow the link to the video site
    e.preventDefault();
    var f=document.createElement('iframe');
    var id=a.getAttribute('data-yt');f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&loop=1&playlist='+id;
    f.title=a.getAttribute('aria-label').replace(/^Play video: /,'');
    f.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen=true;
    a.parentNode.replaceChild(f,a);f.focus();
  });
});

/* ---- Dialog helpers (focus trap + restore) ---- */
function focusables(el){return $$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',el).filter(function(n){return n.offsetParent!==null;});}
function trap(el,e){
  if(e.key!=='Tab')return;
  var f=focusables(el);if(!f.length)return;
  var first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}

/* ---- Mobile menu ---- */
var menu=$('#mobile-menu'),burger=$('[data-menu-open]'),menuReturn=null;
function openMenu(){
  if(!menu)return;
  menuReturn=document.activeElement;
  menu.hidden=false;root.classList.add('menu-open');
  if(burger)burger.setAttribute('aria-expanded','true');
  requestAnimationFrame(function(){menu.classList.add('open');});
  var c=$('[data-menu-close]',menu);if(c)c.focus();
}
function closeMenu(restore){
  if(!menu||menu.hidden)return;
  menu.classList.remove('open');menu.hidden=true;root.classList.remove('menu-open');
  if(burger)burger.setAttribute('aria-expanded','false');
  if(restore!==false&&menuReturn)menuReturn.focus();
}
if(burger)burger.addEventListener('click',openMenu);
if(menu){
  $$('[data-menu-close]',menu).forEach(function(b){b.addEventListener('click',function(){closeMenu();});});
  $$('.mm-links a',menu).forEach(function(a){a.addEventListener('click',function(){closeMenu(false);});});
  menu.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu();else trap(menu,e);});
  window.addEventListener('resize',function(){if(window.innerWidth>960)closeMenu(false);});
}

/* ---- Privacy choices (cookie notice + "Your Privacy Choices" window) ----
   Saved in this browser as localStorage "wise-consent": {"v":1,"translate":bool,"video":bool,"forms":bool}.
   Strictly necessary settings (dark mode, high contrast, these choices) are always on and stay in the browser.
   The one "Functional Cookies" switch allows the outside services together:
   translate = the language menu, video = playing videos here, forms = embedded sign-up forms.
   The site uses no performance (analytics) or targeting (advertising) cookies; the window says so. */
var CONSENT_KEY='wise-consent',CATS=['translate','video','forms'];
function readConsent(){try{var c=JSON.parse(localStorage.getItem(CONSENT_KEY));return c&&c.v===1?c:null;}catch(e){return null;}}
function allowed(cat){var c=readConsent();return !!(c&&c[cat]);}
function saveConsent(vals){
  var c={v:1};CATS.forEach(function(k){c[k]=!!vals[k];});
  try{localStorage.setItem(CONSENT_KEY,JSON.stringify(c));}catch(e){}
  applyConsent();
}
function syncState(i){var st=i.parentNode.querySelector('.cs-state');if(st)st.textContent=i.checked?'Enabled':'Disabled';}
function applyConsent(){
  // Embedded forms: load only when allowed; otherwise show a button that allows and loads them.
  $$('iframe[data-consent-src]').forEach(function(f){
    var hold=f.parentNode.querySelector('.consent-hold');
    if(allowed('forms')){if(!f.getAttribute('src'))f.setAttribute('src',f.getAttribute('data-consent-src'));f.hidden=false;if(hold)hold.hidden=true;}
    else{f.hidden=true;if(hold)hold.hidden=false;}
  });
  var c=readConsent(),on=!!(c&&c.translate&&c.video&&c.forms);
  $$('[data-consent-toggle]').forEach(function(i){i.checked=on;syncState(i);});
}
var PRIVACY='<a href="/privacy.html">Privacy Policy</a>';
var bar=document.createElement('div');
bar.className='consent-bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Privacy choices');bar.hidden=true;
bar.innerHTML='<div class="consent-inner"><div class="consent-text"><h2 class="consent-title">Your Privacy Choices</h2>'+
  '<p>We save a few settings in your browser, like dark mode and your language, so the site works the way you set it. '+
  'Some features (translation, videos and sign-up forms) come from outside services that may set their own cookies. '+
  'Click “Accept all Cookies” to allow them, or “Manage Preferences” to choose which we may use. See our '+PRIVACY+'.</p></div>'+
  '<div class="consent-actions"><button type="button" class="btn-primary" data-consent-all>Accept all Cookies</button>'+
  '<button type="button" class="btn-secondary" data-consent-essential>Necessary only</button>'+
  '<button type="button" class="consent-link" data-consent-open>Manage Preferences</button></div></div>';
var dlg=document.createElement('div');
dlg.className='consent-dialog';dlg.setAttribute('role','dialog');dlg.setAttribute('aria-modal','true');dlg.setAttribute('aria-labelledby','consent-h');dlg.hidden=true;
function cat(key,title,status,text){
  var side=key?'<label class="consent-switch"><input type="checkbox" data-consent-toggle="'+key+'"><span class="sr-only">Allow '+title.toLowerCase()+'</span><span class="cs-track" aria-hidden="true"><span class="cs-thumb"></span></span><span class="cs-state" aria-hidden="true"></span></label>'
               :'<span class="consent-always">'+status+'</span>';
  return '<div class="consent-cat"><details><summary><span class="cc-name">'+title+'</span></summary><p>'+text+'</p></details>'+side+'</div>';
}
dlg.innerHTML='<div class="consent-backdrop" data-consent-close></div><div class="consent-panel">'+
  '<div class="consent-head"><h2 id="consent-h">Your Privacy Choices</h2><button type="button" class="nav-icon-btn" data-consent-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'+
  '<p class="consent-intro">When you visit a website, it may store or read information in your browser, often as cookies. That information can be about your preferences or your device, and it helps the site work the way you expect. You choose which kinds we may use. Select a category to learn more and change your settings. For more about cookies on our website, see our '+PRIVACY+'.</p>'+
  cat('','Strictly Necessary Cookies','Required','These keep the site working and remember the choices you make here, like dark mode, high contrast and these privacy settings. They are saved only in your browser, are never sent to us, and can’t be turned off.')+
  cat('functional','Functional Cookies','','These turn on features from outside services: translating pages from the language menu, playing our videos on the page, and showing program sign-up forms. Those services may set their own cookies. If this is off, the language menu asks before translating, videos open on the video site, and you can still load a sign-up form when you need it.')+
  cat('','Performance Cookies','Not used','These would measure how visitors use the site. We don’t use them.')+
  cat('','Targeting Cookies','Not used','These would be used for advertising. We don’t use them.')+
  '<div class="consent-actions"><button type="button" class="btn-primary" data-consent-save>Save My Choices</button><button type="button" class="btn-secondary" data-consent-all>Accept all Cookies</button></div></div>';
document.body.appendChild(bar);document.body.appendChild(dlg);
var dlgReturn=null;
function openPrefs(){applyConsent();dlgReturn=document.activeElement;dlg.hidden=false;root.classList.add('consent-open');var f=$('summary',dlg);if(f)f.focus();}
function closePrefs(){if(dlg.hidden)return;dlg.hidden=true;root.classList.remove('consent-open');if(dlgReturn&&dlgReturn.focus)dlgReturn.focus();}
function done(vals){saveConsent(vals);bar.hidden=true;closePrefs();}
$$('[data-consent-all]').forEach(function(b){b.addEventListener('click',function(){done({translate:1,video:1,forms:1});});});
$$('[data-consent-essential]').forEach(function(b){b.addEventListener('click',function(){done({});});});
$$('[data-consent-save]').forEach(function(b){b.addEventListener('click',function(){
  var t=$('[data-consent-toggle]',dlg),on=!!(t&&t.checked);done({translate:on,video:on,forms:on});});});
$$('[data-consent-toggle]',dlg).forEach(function(i){i.addEventListener('change',function(){syncState(i);});});
$$('[data-consent-close]',dlg).forEach(function(b){b.addEventListener('click',closePrefs);});
dlg.addEventListener('keydown',function(e){if(e.key==='Escape')closePrefs();else trap(dlg,e);});
document.addEventListener('click',function(e){var o=e.target.closest&&e.target.closest('[data-consent-open]');if(o){e.preventDefault();openPrefs();}});
$$('[data-consent-load]').forEach(function(b){b.addEventListener('click',function(){var c=readConsent()||{};c.forms=true;saveConsent(c);bar.hidden=true;});});
if(!readConsent())bar.hidden=false;
applyConsent();

/* ---- Search ---- */
var modal=$('#search-modal'),input=$('#search-input'),results=$('#search-results'),status=$('#search-status');
var index=null,loading=null,searchReturn=null;
function loadIndex(){
  if(index||loading)return loading;
  loading=fetch('/search-index.json').then(function(r){return r.json();}).then(function(d){index=d;return d;})
    .catch(function(){index=[];status.textContent='Search is unavailable right now. Try the menu instead.';});
  return loading;
}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function run(){
  var q=input.value.trim().toLowerCase();
  results.innerHTML='';
  if(!q){status.textContent='Try “literacy”, “IEP”, “workforce”, or “donate”.';return;}
  if(!index){status.textContent='Loading…';return;}
  var terms=q.split(/\s+/);
  var hits=index.map(function(p){
    var t=p.title.toLowerCase(),d=(p.description||'').toLowerCase(),b=(p.text||'').toLowerCase(),score=0;
    for(var i=0;i<terms.length;i++){
      var w=terms[i],s=0;
      if(t.indexOf(w)>-1)s+=10;
      if(d.indexOf(w)>-1)s+=4;
      if(b.indexOf(w)>-1)s+=1;
      if(!s)return null;
      score+=s;
    }
    return {p:p,score:score};
  }).filter(Boolean).sort(function(a,b){return b.score-a.score;}).slice(0,12);
  status.textContent=hits.length?hits.length+' result'+(hits.length>1?'s':'')+' for “'+input.value.trim()+'”':'No results for “'+input.value.trim()+'”. Try a different word, or contact us.';
  results.innerHTML=hits.map(function(h){
    return '<li><a href="'+esc(h.p.url)+'"><span class="sm-r-title">'+esc(h.p.title)+'</span>'+
      (h.p.description?'<span class="sm-r-desc">'+esc(h.p.description)+'</span>':'')+
      '<span class="sm-r-url">'+esc(h.p.url)+'</span></a></li>';
  }).join('');
}
function openSearch(){
  if(!modal)return;
  searchReturn=menu&&!menu.hidden?burger:document.activeElement;
  closeMenu(false);
  modal.hidden=false;root.classList.add('search-open');
  input.focus();
  var p=loadIndex();if(p)p.then(run);
  run();
}
function closeSearch(){
  if(!modal||modal.hidden)return;
  modal.hidden=true;root.classList.remove('search-open');
  if(searchReturn&&searchReturn.focus)searchReturn.focus();
}
if(modal){
  $$('[data-search-open]').forEach(function(b){b.addEventListener('click',openSearch);});
  $$('[data-search-close]',modal).forEach(function(b){b.addEventListener('click',closeSearch);});
  input.addEventListener('input',run);
  $('.sm-form',modal).addEventListener('submit',function(e){
    e.preventDefault();var a=$('a',results);if(a)location.href=a.getAttribute('href');
  });
  modal.addEventListener('keydown',function(e){if(e.key==='Escape')closeSearch();else trap(modal,e);});
  document.addEventListener('keydown',function(e){
    var typing=/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName||''))||e.target.isContentEditable;
    if((e.key==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!typing)){
      if(modal.hidden){e.preventDefault();openSearch();}
    }
  });
}
})();

/* ---- Open a <details> answer when its link (#id) is visited or clicked ---- */
(function(){
  function openHash(){
    var id=decodeURIComponent(location.hash.slice(1));if(!id)return;
    var el=document.getElementById(id);
    if(el&&el.tagName==='DETAILS'){el.open=true;el.scrollIntoView({block:'start'});}
  }
  window.addEventListener('hashchange',openHash);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',openHash);else openHash();
})();

/* ---- Main menu dropdown panels (desktop) ---- */
(function(){
var btns=Array.prototype.slice.call(document.querySelectorAll('[data-mega]'));
if(!btns.length)return;
var hoverable=window.matchMedia&&matchMedia('(hover: hover) and (pointer: fine)').matches,timer=null;
function panel(b){return document.getElementById(b.getAttribute('aria-controls'));}
function set(b,open){var p=panel(b);if(!p)return;p.hidden=!open;b.setAttribute('aria-expanded',open?'true':'false');}
function closeAll(except){btns.forEach(function(b){if(b!==except)set(b,false);});}
btns.forEach(function(b){
  var item=b.parentNode,p=panel(b);
  b.addEventListener('click',function(e){e.stopPropagation();var open=b.getAttribute('aria-expanded')!=='true';closeAll(b);set(b,open);});
  b.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'){e.preventDefault();closeAll(b);set(b,true);var a=p&&p.querySelector('a');if(a)a.focus();}
  });
  if(p)p.addEventListener('keydown',function(e){if(e.key==='Escape'){set(b,false);b.focus();}});
  item.addEventListener('focusout',function(e){if(!item.contains(e.relatedTarget))set(b,false);});
  if(hoverable){
    item.addEventListener('mouseenter',function(){clearTimeout(timer);timer=setTimeout(function(){closeAll(b);set(b,true);},120);});
    item.addEventListener('mouseleave',function(){clearTimeout(timer);timer=setTimeout(function(){set(b,false);},180);});
  }
});
document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.mega-item'))closeAll();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var o=btns.filter(function(b){return b.getAttribute('aria-expanded')==='true';})[0];if(o){set(o,false);o.focus();}}});
window.addEventListener('resize',function(){if(window.innerWidth<=960)closeAll();});
})();
