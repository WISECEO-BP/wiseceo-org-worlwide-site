/* Fills article grids marked [data-news-feed] with the latest newsletter posts from
   /api/posts. The hand-written cards stay in place if the feed is unavailable. */
(function(){
var grids=document.querySelectorAll('[data-news-feed]');
if(!grids.length||!window.fetch)return;
var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function month(ts){if(!ts)return '';var d=new Date(ts*1000);return MONTHS[d.getMonth()]+' '+d.getFullYear();}
function card(p){
  var art;
  if(p.image){
    var i=esc(p.image);
    art='<img src="'+i+'.webp" srcset="'+i+'-640.webp 640w, '+i+'-960.webp 960w, '+i+'.webp 1200w" sizes="(max-width: 620px) 100vw, 540px" alt="" loading="lazy" width="1200" height="670"/>';
  }else if(p.thumbnail){
    art='<img src="'+esc(p.thumbnail)+'" alt="" loading="lazy" width="1200" height="670"/>';
  }else{
    art='<div class="post-art" aria-hidden="true"><span>'+esc(p.title.split(':')[0])+'</span></div>';
  }
  var tag=esc(p.tag)+(p.date?' · '+month(p.date):'');
  return '<a class="post-card" href="'+esc(p.url)+'">'+art+'<div class="post-body"><span class="post-tag">'+tag+'</span><h3>'+esc(p.title)+'</h3>'+
    (p.subtitle?'<p>'+esc(p.subtitle)+'</p>':'')+'<span class="post-more">Read the article →</span></div></a>';
}
fetch('/api/posts',{headers:{Accept:'application/json'}})
  .then(function(r){return r.ok?r.json():null;})
  .then(function(d){
    if(!d||!d.ok||!d.posts||!d.posts.length)return;
    Array.prototype.forEach.call(grids,function(g){
      var n=parseInt(g.getAttribute('data-news-feed'),10)||d.posts.length;
      g.innerHTML=d.posts.slice(0,n).map(card).join('');
      var label=document.querySelector('[data-news-month]');
      if(label&&d.posts[0].date)label.textContent='Latest from W.I.S.E.C.E.O. · '+month(d.posts[0].date);
    });
  })
  .catch(function(){});
})();
