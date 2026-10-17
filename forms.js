/* Contact + newsletter forms: save to Airtable via /api, with email fallbacks. */
(function(){
var WEB3FORMS_KEY='d066dff7-b541-4154-922e-143075b3f688';
var BEEHIIV_URL='https://wiseceo.beehiiv.com/subscribe';
var LANGS={es:'Spanish',ar:'Arabic',fr:'French',ht:'Haitian Creole',ps:'Pashto',fa:'Dari / Persian',uk:'Ukrainian',
  sw:'Swahili',so:'Somali',ne:'Nepali',vi:'Vietnamese',pt:'Portuguese','zh-CN':'Chinese (Simplified)'};

// The language the visitor is reading the site in, so staff can reply in it.
function siteLanguage(){
  var m=document.cookie.match(/(?:^|;\s*)googtrans=\/[^\/;]*\/([^;]+)/);
  return (m&&LANGS[decodeURIComponent(m[1])])||'English';
}
function formData(f){var d={};new FormData(f).forEach(function(v,k){d[k]=v;});return d;}
function postJSON(url,body){
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)})
    .then(function(r){return r.json().catch(function(){return {};}).then(function(j){j.status=r.status;return j;});});
}
function setStatus(el,cls,html){el.className='form-status'+(cls?' '+cls:'');el.innerHTML=html;}
function busy(f,on){var b=f.querySelector('[type=submit]');if(b){b.disabled=on;b.setAttribute('aria-busy',on?'true':'false');}}

/* ---------- Contact form ---------- */
var cf=document.getElementById('contactForm');
if(cf){
  var subject='Website inquiry — W.I.S.E.C.E.O.';
  var mailFallback=function(d){
    var body=['name','email','interest','message'].filter(function(k){return d[k];})
      .map(function(k){return k.charAt(0).toUpperCase()+k.slice(1)+': '+d[k];}).join('\n\n');
    window.location.href='mailto:admin@wiseceo.org?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  };
  cf.addEventListener('submit',function(e){
    e.preventDefault();
    var st=document.getElementById('contactStatus'),d=formData(cf);
    if(d.botcheck)return;
    d.language=siteLanguage();d.page=location.pathname;
    setStatus(st,'info','Sending…');busy(cf,true);
    // Airtable keeps the record; Web3Forms emails the team. Either one getting through is a success.
    var toAirtable=postJSON('/api/contact',d).then(function(r){return r.ok===true;},function(){return false;});
    var toEmail=postJSON('https://api.web3forms.com/submit',{access_key:WEB3FORMS_KEY,subject:subject,
        from_name:'wiseceo.org contact form',name:d.name,email:d.email,replyto:d.email,
        interest:d.interest||'',language:d.language,message:d.message})
      .then(function(r){return r.success===true;},function(){return false;});
    Promise.all([toAirtable,toEmail]).then(function(res){
      busy(cf,false);
      if(res[0]||res[1]){
        setStatus(st,'ok','Thank you! Your message has been received — we’ll be in touch soon.');cf.reset();
      }else{
        setStatus(st,'info','Opening your email app so your message reaches us…');mailFallback(d);
      }
    });
  });
}

/* ---------- Newsletter sign-up forms ---------- */
Array.prototype.forEach.call(document.querySelectorAll('[data-newsletter-form]'),function(f){
  var st=f.parentNode.querySelector('[data-nl-status]');
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var d=formData(f);
    if(d.website)return;
    var email=(d.email||'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
      setStatus(st,'err','Please enter a valid email address.');f.querySelector('[name=email]').focus();return;
    }
    setStatus(st,'info','Signing you up…');busy(f,true);
    postJSON('/api/subscribe',{email:email,language:siteLanguage(),page:location.pathname})
      .then(function(r){
        busy(f,false);
        if(r.ok&&r.beehiiv){
          setStatus(st,'ok','You’re subscribed! Check your inbox for a welcome email.');f.reset();
        }else if(r.ok){
          setStatus(st,'ok','Thank you — you’re on our list! One last step: <a href="'+BEEHIIV_URL+'?email='+encodeURIComponent(email)+'" target="_blank" rel="noopener">confirm on our newsletter page</a> so our emails reach your inbox.');f.reset();
        }else if(r.error==='invalid'){
          setStatus(st,'err','Please enter a valid email address.');
        }else{
          throw new Error(r.error||'failed');
        }
      })
      .catch(function(){
        busy(f,false);
        setStatus(st,'err','We couldn’t save your sign-up just now. You can <a href="'+BEEHIIV_URL+'" target="_blank" rel="noopener">subscribe directly here</a>.');
      });
  });
});
})();
