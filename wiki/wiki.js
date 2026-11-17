/* W.I.S.E.C.E.O. Wiki: Contents hide/show and dark-mode toggle (saved in this browser only). */
(function(){
  var root=document.documentElement;
  var toc=document.querySelector('.toc-toggle'),list=document.getElementById('toc-list');
  if(toc&&list){
    toc.addEventListener('click',function(){
      var hide=!list.hidden;list.hidden=hide;
      toc.textContent=hide?'show':'hide';toc.setAttribute('aria-expanded',hide?'false':'true');
    });
  }
  var btn=document.getElementById('theme-toggle');if(!btn)return;
  function sync(){var dark=root.getAttribute('data-theme')==='dark';
    btn.textContent=dark?'Light Mode':'Dark Mode';btn.setAttribute('aria-pressed',dark?'true':'false');}
  btn.addEventListener('click',function(){
    var dark=root.getAttribute('data-theme')!=='dark';
    if(dark)root.setAttribute('data-theme','dark');else root.removeAttribute('data-theme');
    try{localStorage.setItem('theme',dark?'dark':'light');}catch(e){}
    sync();
  });
  sync();
})();

/* Language: same googtrans cookie the main site's language menu uses. */
(function(){
  function currentLang(){var m=document.cookie.match(/(?:^|;\s*)googtrans=\/[^\/;]*\/([^;]+)/);return m?decodeURIComponent(m[1]):'en';}
  function writeLangCookie(lang){
    var val=lang==='en'?'':'/en/'+lang,exp=lang==='en'?'; expires=Thu, 01 Jan 1970 00:00:00 GMT':'';
    document.cookie='googtrans='+val+'; path=/'+exp;
    var host=location.hostname;
    if(host.indexOf('.')>-1){var base=host.replace(/^www\./,'');
      document.cookie='googtrans='+val+'; path=/; domain=.'+base+exp;
      document.cookie='googtrans='+val+'; path=/; domain='+host+exp;}
  }
  var lang=currentLang();
  document.querySelectorAll('.lang[data-lang]').forEach(function(b){
    if(b.getAttribute('data-lang')===lang)b.setAttribute('aria-current','true');
    b.addEventListener('click',function(){writeLangCookie(b.getAttribute('data-lang'));location.reload();});
  });
  var read=document.querySelector('.portal-read-btn'),all=document.getElementById('portal-all-langs');
  if(read&&all)read.addEventListener('click',function(){all.hidden=!all.hidden;read.setAttribute('aria-expanded',all.hidden?'false':'true');});
  if(lang!=='en'){
    var holder=document.createElement('div');holder.id='google_translate_element';holder.hidden=true;document.body.appendChild(holder);
    window.wiseTranslateInit=function(){new google.translate.TranslateElement({pageLanguage:'en',autoDisplay:false},'google_translate_element');};
    var gt=document.createElement('script');gt.src='https://translate.google.com/translate_a/element.js?cb=wiseTranslateInit';gt.async=true;document.body.appendChild(gt);
  }
})();

/* Main-page search over the site's search index (wiki only, or the whole site). */
(function(){
  var form=document.querySelector('[data-wiki-search]'),out=document.querySelector('[data-wiki-results]');
  if(!form||!out)return;
  var index=null;
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function load(){return index?Promise.resolve(index):fetch('/search-index.json').then(function(r){return r.json();}).then(function(d){index=d;return d;});}
  function run(){
    var q=form.q.value.trim().toLowerCase(),scope=form.scope.value;
    if(!q){out.innerHTML='';return;}
    var terms=q.split(/\s+/);
    load().then(function(d){
      var hits=d.filter(function(e){return scope==='site'||e.url.indexOf('/wiki/')===0;})
        .map(function(e){var t=(e.title+' '+e.description).toLowerCase(),b=(e.text||'').toLowerCase(),s=0;
          for(var i=0;i<terms.length;i++){if(t.indexOf(terms[i])>-1)s+=3;else if(b.indexOf(terms[i])>-1)s+=1;else return null;}
          return {e:e,s:s};})
        .filter(Boolean).sort(function(a,b){return b.s-a.s;}).slice(0,8);
      out.innerHTML=hits.length?'<ul>'+hits.map(function(h){return '<li><a href="'+esc(h.e.url)+'">'+esc(h.e.title)+'</a><p>'+esc((h.e.description||'').slice(0,160))+'</p></li>';}).join('')+'</ul>'
        :'<div class="none">No results for “'+esc(form.q.value.trim())+'”.</div>';
    }).catch(function(){out.innerHTML='<div class="none">Search is unavailable right now.</div>';});
  }
  form.addEventListener('submit',function(e){e.preventDefault();run();});
  var t;form.q.addEventListener('input',function(){clearTimeout(t);t=setTimeout(run,200);});
  form.scope.addEventListener('change',run);
})();
