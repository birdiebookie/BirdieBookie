/* BirdieBookie Fast Invite - scorecard setup */
(function () {
  'use strict';
  const PANEL = 'bbFastInvitePanel';

  function roomCode() {
    return localStorage.getItem('birdiebookieRoomCode') || sessionStorage.getItem('birdiebookieRoomCode') || '';
  }

  function createRoomCodeIfNeeded() {
    let code = roomCode();
    if (!code) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      code = '';
      for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      localStorage.setItem('birdiebookieRoomCode', code);
      sessionStorage.setItem('birdiebookieRoomCode', code);
    }
    localStorage.setItem('birdiebookieIsScorekeeper', 'true');
    sessionStorage.setItem('birdiebookieIsScorekeeper', 'true');
    return code;
  }

  function addStyles() {
    if (document.getElementById('bbFastInviteStyles')) return;
    const s = document.createElement('style');
    s.id = 'bbFastInviteStyles';
    s.textContent = `
#bbFastInvitePanel{background:#111;border:3px solid #00ff99;border-radius:16px;margin:14px;padding:16px;box-sizing:border-box;font-family:Arial;text-align:center}
.bbfi-title{color:#00ff99;font-size:24px;font-weight:bold}.bbfi-sub{color:#fff;font-size:14px;margin:6px auto 14px;max-width:850px}
.bbfi-skip{display:flex;justify-content:center;align-items:center;gap:10px;color:#ffdd44;font-size:16px;font-weight:bold;margin:0 auto 14px}
.bbfi-skip input{width:20px;height:20px;accent-color:#00ff99;cursor:pointer}
.bbfi-head,.bbfi-row{display:grid;grid-template-columns:110px 1fr 1fr;gap:10px;align-items:center;max-width:900px;margin:0 auto 8px}
.bbfi-head{color:#ffdd44;font-size:13px;font-weight:bold;text-align:left}.bbfi-row strong{color:#00ff99;text-align:left}
.bbfi-row input{width:100%;box-sizing:border-box;background:#000;color:#fff;border:2px solid #00ff99;border-radius:8px;padding:10px;font-size:16px}
.bbfi-actions{margin-top:12px}.bbfi-actions button{background:#00ff99;color:#000;border:0;border-radius:20px;padding:12px 28px;font-size:18px;font-weight:bold;cursor:pointer}.bbfi-actions span{color:#ffdd44;font-weight:bold;margin-left:12px}
@media(max-width:650px){.bbfi-head,.bbfi-row{grid-template-columns:80px 1fr}.bbfi-head span:last-child,.bbfi-row input:last-child{grid-column:2}}
    `;
    document.head.appendChild(s);
  }

  function makePanel() {
    if (document.getElementById(PANEL)) return;
    const p = document.createElement('div');
    p.id = PANEL;
    p.innerHTML = `
      <div class="bbfi-title">📲 INVITE YOUR GOLFERS</div>
      <div class="bbfi-sub">Enter the 3 golfers you want to invite. Their names will also be placed on the scorecard.</div>
      <label class="bbfi-skip"><input id="bbfiSkip" type="checkbox"> SKIP INVITES</label>
      <div class="bbfi-head"><span>PLAYER</span><span>NAME</span><span>PHONE NUMBER</span></div>
      ${[1,2,3].map(n=>`<div class="bbfi-row"><strong>PLAYER ${n}</strong><input id="bbfiName${n}" type="text" placeholder="Name"><input id="bbfiPhone${n}" type="tel" placeholder="Phone number"></div>`).join('')}
      <div class="bbfi-actions"><button id="bbfiSend">📲 SEND INVITES</button><span id="bbfiStatus"></span></div>`;
    document.body.insertBefore(p, document.body.firstElementChild || null);
    const old = JSON.parse(localStorage.getItem('birdiebookieInviteContacts') || '[]');
    [1,2,3].forEach(n=>{ if(old[n-1]){document.getElementById('bbfiName'+n).value=old[n-1].name||'';document.getElementById('bbfiPhone'+n).value=old[n-1].phone||'';} });
    document.getElementById('bbfiSend').onclick = sendInvites;
    document.getElementById('bbfiSkip').onchange = function(){
      if(this.checked){
        /* Skipping invites still means THIS device is the scorekeeper.
           Make sure the existing scorecard inputs are unlocked before removing the panel. */
        createRoomCodeIfNeeded();
        if(typeof setEditingLocked==='function') setEditingLocked(false);
        const d=document.getElementById('roomCodeDisplay');
        if(d) d.textContent='Room Code: '+roomCode();
        const panel=document.getElementById(PANEL);
        if(panel)panel.remove();
      }
    };
  }

  function contacts() {
    return [1,2,3].map(n=>({name:document.getElementById('bbfiName'+n).value.trim(),phone:document.getElementById('bbfiPhone'+n).value.trim()}));
  }

  function syncNames(c) {
    c.forEach((x,i)=>{
      const el=document.getElementById('name'+(i+1));
      if(el&&x.name){
        el.value=x.name;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    if(typeof updateNames==='function')updateNames();
    if(typeof updateLeaderboard==='function')updateLeaderboard();
    localStorage.setItem('birdiebookieInviteContacts',JSON.stringify(c));
  }

  function joinUrl(code){
    return window.location.origin+'/scorecards.html?room='+encodeURIComponent(code);
  }

  async function sendInvites(){
    const b=document.getElementById('bbfiSend'),st=document.getElementById('bbfiStatus'),c=contacts();
    if(!c.some(x=>x.name||x.phone)){st.textContent='Enter at least one golfer.';return;}
    b.disabled=true;
    try{
      syncNames(c);
      const code=createRoomCodeIfNeeded();
      const url=joinUrl(code);
      const names=c.filter(x=>x.name).map(x=>x.name).join(', ');
      const text=(names?names+', ':'')+'you are invited to a BirdieBookie round!\n\nRoom Code: '+code+'\n\nTap to join:\n'+url;

      if(navigator.share){
        st.textContent='Opening share...';
        await navigator.share({title:'BirdieBookie Invite',text:text,url:url});
      } else if(navigator.clipboard){
        await navigator.clipboard.writeText(text);
        st.textContent='INVITATION COPIED!';
      } else {
        window.prompt('Copy this BirdieBookie invitation:',text);
      }

      if(typeof window.cloudSaveRound!=='function') throw new Error('BirdieBookie cloud save is not available.');
      st.textContent='Saving round...';
      await window.cloudSaveRound();

      const p=document.getElementById(PANEL);if(p)p.remove();
    }catch(e){
      if(e.name==='AbortError')st.textContent='Share cancelled. Room '+roomCode()+' is still active.';
      else st.textContent='Invite failed: '+e.message;
    }finally{b.disabled=false;}
  }

  async function autoJoin(){
    const code=(new URLSearchParams(location.search).get('room')||'').trim().toUpperCase();
    if(!code||typeof sbClient==='undefined')return;
    try{
      const r=await sbClient.from('birdiebookie_rounds').select('data,scorekeeper_device').eq('room_code',code).single();
      if(r.error||!r.data){alert('This BirdieBookie room could not be found.');return;}
      localStorage.setItem('birdiebookieRoomCode',code);
      sessionStorage.setItem('birdiebookieRoomCode',code);
      const keeper=r.data.scorekeeper_device===DEVICE_ID;
      localStorage.setItem('birdiebookieIsScorekeeper',keeper?'true':'false');
      sessionStorage.setItem('birdiebookieIsScorekeeper',keeper?'true':'false');
      if(typeof applyCloudRoundData==='function')applyCloudRoundData(r.data.data);
      if(typeof setEditingLocked==='function')setEditingLocked(!keeper);
      const d=document.getElementById('roomCodeDisplay');if(d)d.textContent='Room Code: '+code;
      const p=document.getElementById(PANEL);if(p)p.remove();
      history.replaceState({},document.title,location.pathname);
    }catch(e){console.error(e)}
  }

  document.addEventListener('DOMContentLoaded',function(){
    addStyles();
    makePanel();
    setTimeout(autoJoin,250);
  });
})();
