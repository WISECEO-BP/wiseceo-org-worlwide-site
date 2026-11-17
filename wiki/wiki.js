/* W.I.S.E.C.E.O. Wiki: dark-mode toggle (preference saved in this browser only). */
(function(){
  var btn=document.getElementById('theme-toggle');if(!btn)return;
  var root=document.documentElement;
  function sync(){var dark=root.getAttribute('data-theme')==='dark';
    btn.textContent=dark?'Toggle Light Mode':'Toggle Dark Mode';btn.setAttribute('aria-pressed',dark?'true':'false');}
  btn.addEventListener('click',function(){
    var dark=root.getAttribute('data-theme')!=='dark';
    if(dark)root.setAttribute('data-theme','dark');else root.removeAttribute('data-theme');
    try{localStorage.setItem('theme',dark?'dark':'light');}catch(e){}
    sync();
  });
  sync();
})();
