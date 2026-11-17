/* Contact-message confirmation: /confirm.html?m=<record id>&t=<token> */
(function(){
var btn=document.getElementById('cf-btn');if(!btn)return;
var q=new URLSearchParams(location.search),m=q.get('m')||'',t=q.get('t')||'';
var st=document.getElementById('cf-status'),actions=document.getElementById('cf-actions');
var title=document.getElementById('cf-title'),lead=document.getElementById('cf-lead');
function status(cls,text){st.className='form-status '+cls;st.textContent=text;}
function problem(head,text){
  actions.hidden=true;title.textContent=head;lead.textContent=text;st.className='form-status';st.textContent='';
  document.getElementById('cf-problem').hidden=false;
}
var MSG={
  expired:['This link has expired','Confirmation links work for 7 days. Please send your message again and confirm it from the new email.'],
  invalid:['This link isn’t valid','The link may be incomplete. Try opening it straight from the email, or send your message again.'],
  not_found:['We couldn’t find that message','It may have been removed. Please send your message again.']
};
if(!/^rec[A-Za-z0-9]{14}$/.test(m)||!t){problem(MSG.invalid[0],MSG.invalid[1]);return;}
btn.addEventListener('click',function(){
  btn.disabled=true;btn.setAttribute('aria-busy','true');status('info','Confirming…');
  fetch('/api/confirm',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({m:m,t:t})})
    .then(function(r){return r.json().catch(function(){return {};});},function(){return {};})
    .then(function(r){
      btn.disabled=false;btn.setAttribute('aria-busy','false');
      if(r.ok){
        actions.hidden=true;title.textContent='Thank you, your message is confirmed!';
        lead.textContent='Our team has your message and will be in touch soon.';
        st.className='form-status';st.textContent='';document.getElementById('cf-done').hidden=false;
        title.setAttribute('tabindex','-1');title.focus();
      }else if(MSG[r.error]){problem(MSG[r.error][0],MSG[r.error][1]);}
      else{status('err','Something went wrong on our side. Please try again in a minute.');}
    });
});
})();
