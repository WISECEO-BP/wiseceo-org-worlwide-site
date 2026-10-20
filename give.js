/* Give page: one panel, one button. Builds the Donorbox checkout link from the chosen frequency and amount. */
(function(){
var form=document.querySelector('.give-form');if(!form)return;
var IMPACT={
  m:{'4.99':'Become a member: for about the cost of a coffee, you keep digital literacy, language access and workforce programs running all year.',
     '10':'Become a member at $10 a month: steady support our programs can plan around.',
     '25':'Become a member at $25 a month: steady support our programs can plan around.',
     '':'Choose your own monthly amount at checkout.'},
  o:{'25':'Puts a coding starter kit in the hands of one first-time learner.',
     '50':'Sponsors a week of digital-literacy training for someone starting from zero.',
     '250':'Funds a full workforce-readiness pathway, from first class to first interview.',
     '':'Choose any amount at checkout. Every dollar reaches a learner.'}
};
var impact=document.getElementById('gp-impact'),btn=document.getElementById('gp-submit');
function interval(){return form.querySelector('[name=default_interval]:checked').value;}
function group(iv){return form.querySelector('.gp-amounts[data-interval="'+iv+'"]');}
function amount(){var r=group(interval()).querySelector('input:checked');return r?r.value:'';}
function update(){
  var iv=interval();
  ['m','o'].forEach(function(k){var g=group(k);g.hidden=k!==iv;g.disabled=k!==iv;});
  var a=amount();
  impact.textContent=IMPACT[iv][a]||'';
  btn.textContent=a?('Give $'+a+(iv==='m'?' / month':' once')+' →'):(iv==='m'?'Choose your monthly amount →':'Choose your amount →');
}
form.addEventListener('change',update);
form.addEventListener('submit',function(e){
  e.preventDefault();
  var a=amount(),url=form.action+'?default_interval='+interval()+(a?'&amount='+encodeURIComponent(a):'');
  location.href=url;
});
if(location.hash==='#give-once'){form.querySelector('[name=default_interval][value=o]').checked=true;}
update();
})();
