/* Topic filter chips on /blog.html. Without JavaScript every story stays visible. */
(function(){
var chips=document.querySelectorAll('[data-topic-filter]');
if(!chips.length)return;
var items=document.querySelectorAll('[data-topic]'),empty=document.querySelector('.blog-empty');
Array.prototype.forEach.call(chips,function(c){
  c.addEventListener('click',function(){
    var t=c.getAttribute('data-topic-filter'),shown=0;
    Array.prototype.forEach.call(chips,function(o){o.setAttribute('aria-pressed',o===c?'true':'false');});
    Array.prototype.forEach.call(items,function(i){var on=!t||i.getAttribute('data-topic')===t;i.hidden=!on;if(on&&i.classList.contains('blog-card'))shown++;});
    if(empty)empty.hidden=shown>0||!document.querySelector('.blog-card');
  });
});
})();
