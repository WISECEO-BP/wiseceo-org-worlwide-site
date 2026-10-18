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
  s.addEventListener('change',function(){writeLangCookie(s.value);location.reload();});
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
// One place to change the membership checkout link (e.g. a dedicated Donorbox membership campaign).
var MEMBERSHIP_URL='https://donorbox.org/wiseceo-donate-today?default_interval=m&amount=4.99';
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
