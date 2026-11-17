/* Give page: one panel, one button. Builds the Donorbox checkout link from the chosen frequency and amount. */
(function(){
var form=document.querySelector('.give-form');if(!form)return;
var IMPACT={
  m:{'4.99':'Become a member: for about the cost of a coffee, you keep digital literacy, language access and workforce programs running all year.'},
  o:{'25':'Puts a coding starter kit in the hands of one first-time learner.',
     '50':'Sponsors a week of digital-literacy training for someone starting from zero.',
     '250':'Funds a full workforce-readiness pathway, from first class to first interview.'}
};
var DEFAULT_IMPACT={m:'Monthly gifts are steady support our programs can plan around, all year.',o:'Every dollar reaches a learner.'};
var other=document.getElementById('gp-other'),err=document.getElementById('gp-error');
var impact=document.getElementById('gp-impact'),total=document.getElementById('gp-total'),btn=document.getElementById('gp-submit');
var freqWord=document.getElementById('gp-freq-word'),banner=document.getElementById('gp-banner');

function interval(){return form.querySelector('[name=default_interval]:checked').value;}
function group(iv){return form.querySelector('.gp-amounts[data-interval="'+iv+'"]');}
function otherValue(){
  var v=other.value.replace(/[^0-9.]/g,'');
  if(!v)return '';
  var n=Math.round(parseFloat(v)*100)/100;
  return isFinite(n)?String(n):'';
}
function amount(){
  var o=otherValue();if(other.value.trim())return o;
  var r=group(interval()).querySelector('input:checked');return r?r.value:'';
}
function money(a){var n=parseFloat(a);return '$'+(n%1?n.toFixed(2):String(n));}
function update(){
  var iv=interval(),a=amount(),monthly=iv==='m';
  ['m','o'].forEach(function(k){var g=group(k);g.hidden=k!==iv;g.disabled=k!==iv;});
  freqWord.textContent=monthly?'monthly':'one-time';
  banner.hidden=!monthly;
  impact.textContent=(a&&IMPACT[iv][a])||DEFAULT_IMPACT[iv];
  total.textContent=a?money(a)+(monthly?' Monthly':' One-time'):'—';
  btn.textContent=a?('Donate '+money(a)+(monthly?' monthly':'')+' →'):'Enter an amount';
}
form.addEventListener('change',function(e){
  if(e.target.matches('.gp-amounts input')){other.value='';err.hidden=true;}
  update();
});
other.addEventListener('input',function(){
  if(other.value.trim()){var r=group(interval()).querySelector('input:checked');if(r)r.checked=false;}
  err.hidden=true;update();
});
form.addEventListener('submit',function(e){
  e.preventDefault();
  var a=amount();
  if(!a||parseFloat(a)<1){err.hidden=false;other.focus();return;}
  location.href=form.action+'?default_interval='+interval()+'&amount='+encodeURIComponent(a);
});
if(location.hash==='#give-once'){form.querySelector('[name=default_interval][value=o]').checked=true;}
update();
})();
/* Campaign total: edit data-raised / data-goal / data-updated on #gp-progress in give.html. */
(function(){
var p=document.getElementById('gp-progress');if(!p)return;
var raised=parseFloat(p.dataset.raised)||0,goal=parseFloat(p.dataset.goal)||0;
function usd(n){return '$'+n.toLocaleString('en-US',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});}
document.getElementById('gp-raised').textContent=usd(raised);
if(p.dataset.updated)document.getElementById('gp-updated').textContent=p.dataset.updated;
if(goal>0){
  var pct=Math.min(100,Math.round(raised/goal*100)),bar=document.getElementById('gp-bar'),gt=document.getElementById('gp-goal-text');
  gt.textContent='of '+usd(goal)+' goal ('+pct+'%)';gt.hidden=false;
  bar.setAttribute('aria-valuemax',goal);bar.setAttribute('aria-valuenow',raised);bar.setAttribute('aria-valuetext',usd(raised)+' of '+usd(goal));
  bar.hidden=false;requestAnimationFrame(function(){document.getElementById('gp-bar-fill').style.width=pct+'%';});
}
})();
