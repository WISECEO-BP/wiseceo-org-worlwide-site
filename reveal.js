(function(){
var els=document.querySelectorAll('.fade-in');
function revealAll(){for(var i=0;i<els.length;i++)els[i].classList.add('visible');}
if(!('IntersectionObserver' in window)){revealAll();return;}
try{
var obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.classList.add('visible');});},{threshold:.1});
for(var i=0;i<els.length;i++)obs.observe(els[i]);
/* safety net: never leave content invisible */
setTimeout(revealAll,2500);
}catch(err){revealAll();}
})();
