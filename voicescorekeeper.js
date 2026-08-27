(function () {

  const wordToNum = {
    'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,
    'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
    'eleven':11,'twelve':12,
    'for':4,'fore':4,'ford':4,'too':2,'to':2,
    '0':0,'1':1,'2':2,'3':3,'4':4,
    '5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'11':11,'12':12
  };

  function speak(text) {
    return new Promise(resolve => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.onend = resolve;
      window.speechSynthesis.speak(u);
    });
  }

  function playCaching() {
    return new Promise(resolve => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        function beep(freq, start, dur, vol) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq; o.type = 'square';
          g.gain.setValueAtTime(vol, ctx.currentTime + start);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
          o.start(ctx.currentTime + start);
          o.stop(ctx.currentTime + start + dur);
        }
        beep(1200, 0.00, 0.05, 0.3);
        beep(800,  0.05, 0.05, 0.3);
        beep(1500, 0.10, 0.08, 0.4);
        beep(1000, 0.18, 0.15, 0.3);
        setTimeout(resolve, 450);
      } catch(e) { resolve(); }
    });
  }

  function getPlayerNames() {
    return [
      document.getElementById('name1')?.value?.trim() || 'Player 1',
      document.getElementById('name2')?.value?.trim() || 'Player 2',
      document.getElementById('name3')?.value?.trim() || 'Player 3',
      document.getElementById('name4')?.value?.trim() || 'Player 4',
    ];
  }

  function holeToIndex(holeNum) {
    if (holeNum >= 1 && holeNum <= 9) return holeNum - 1;
    if (holeNum >= 10 && holeNum <= 18) return holeNum;
    return null;
  }

  function getNextIncompleteHole() {
    const playerIds = ['player1','player2','player3','player4'];
    for (let holeNum = 1; holeNum <= 18; holeNum++) {
      const idx = holeToIndex(holeNum);
      let allFilled = true;
      for (const pid of playerIds) {
        const boxes = document.querySelectorAll('#' + pid + ' .hole-box');
        if (!boxes[idx] || boxes[idx].value.trim() === '') { allFilled = false; break; }
      }
      if (!allFilled) return holeNum;
    }
    return null;
  }

  function fillScoresWithHighlight(holeNum, scores) {
    const playerIds = ['player1','player2','player3','player4'];
    const idx = holeToIndex(holeNum);
    if (idx === null) return;

    for (let i = 0; i < 4; i++) {
      if (scores[i] === undefined) continue;
      const boxes = document.querySelectorAll('#' + playerIds[i] + ' .hole-box');
      if (!boxes[idx]) continue;
      boxes[idx].value = scores[i];
      boxes[idx].dispatchEvent(new Event('input', { bubbles: true }));
    }

    for (let i = 0; i < 4; i++) {
      const boxes = document.querySelectorAll('#' + playerIds[i] + ' .hole-box');
      if (!boxes[idx]) continue;
      if (scores[i] === undefined) {
        boxes[idx].style.backgroundColor = 'orange';
        boxes[idx].style.color = 'black';
      }
    }
  }

  function getSkinWinner(scores, names) {
    const entries = Object.entries(scores).map(([i,s]) => ({i:parseInt(i), score:s}));
    if (entries.length < 2) return null;
    const min = Math.min(...entries.map(e => e.score));
    const winners = entries.filter(e => e.score === min);
    if (winners.length === 1) return names[winners[0].i];
    return null;
  }

  // ---------------- NEW: single-utterance parsing ----------------

  function extractHoleNumber(text) {
    const m = text.match(/\bhole\s+(\w+)/);
    if (!m) return null;
    const cleaned = m[1].replace(/[^a-z0-9]/g, '');
    const val = wordToNum[cleaned];
    if (val !== undefined) return val;
    const asInt = parseInt(cleaned);
    return isNaN(asInt) ? null : asInt;
  }

  function stripWakeAndHole(text) {
    let t = text;
    t = t.replace(/\bhey\b/g, '');
    t = t.replace(/\bbirdie\s?bookie\b/g, '');
    t = t.replace(/\bbirdie\s?rookie\b/g, '');
    t = t.replace(/\bbirdie\s?cookie\b/g, '');
    t = t.replace(/\bbirdie\s?boogie\b/g, '');
    t = t.replace(/\bhole\s+\w+\b/g, '');
    return t.trim();
  }

  function parseHoleSentence(text, names) {
    const tokens = text.toLowerCase().split(/\s+/)
      .map(t => t.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean);
    const lowerNames = names.map(n => (n || '').toLowerCase().split(/\s+/)[0]);
    const scores = {};

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const playerIdx = lowerNames.findIndex(n => n && n === tok);
      if (playerIdx === -1) continue;
      for (let j = i + 1; j < Math.min(i + 4, tokens.length); j++) {
        const val = wordToNum[tokens[j]];
        if (val !== undefined) {
          scores[playerIdx] = val;
          i = j;
          break;
        }
      }
    }
    return scores;
  }

  function createMicIcon() {
    const existing = document.getElementById('bb-mic-icon');
    if (existing) return existing;
    const mic = document.createElement('div');
    mic.id = 'bb-mic-icon';
    mic.innerHTML = '🎤';
    mic.style.cssText = `
      position:fixed; bottom:30px; right:30px; font-size:48px;
      display:none; z-index:9999; background:rgba(0,255,153,0.3);
      border-radius:50%; width:80px; height:80px; line-height:80px;
      text-align:center; border:3px solid #00ff99;
    `;
    document.body.appendChild(mic);
    return mic;
  }

  function createDebugBox() {
    const existing = document.getElementById('bb-debug-box');
    if (existing) return existing;
    const box = document.createElement('div');
    box.id = 'bb-debug-box';
    box.style.cssText = `
      position:fixed; top:0; left:0; width:100%;
      background:rgba(0,0,0,0.92); color:#00ff99;
      font-size:16px; font-family:monospace; padding:10px 14px;
      z-index:10000; display:none; max-height:35%; overflow-y:auto;
      border-bottom:3px solid #00ff99; white-space:pre-wrap; line-height:1.4;
    `;
    document.body.appendChild(box);
    return box;
  }

  let debugBox = null;
  function debugLog(text) {
    console.log(text);
    if (!debugBox) debugBox = createDebugBox();
    debugBox.style.display = 'block';
    const line = document.createElement('div');
    line.textContent = text;
    debugBox.appendChild(line);
    debugBox.scrollTop = debugBox.scrollHeight;
    while (debugBox.children.length > 12) {
      debugBox.removeChild(debugBox.firstChild);
    }
  }

  let recognition = null;
  let micIcon = null;
  let userWantsListening = false;
  let qaActive = false;
  let qaResolveAnswer = null;

  function listenForFollowUp(timeoutMs) {
    return new Promise(resolve => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; qaResolveAnswer = null; resolve(null); }
      }, timeoutMs);
      qaResolveAnswer = function(transcript) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        qaResolveAnswer = null;
        resolve(transcript);
      };
    });
  }

  async function processUtterance(rawText) {
    if (qaActive) return;
    qaActive = true;
    micIcon.style.display = 'block';

    let hole = extractHoleNumber(rawText);
    let names = getPlayerNames();
    let scores = parseHoleSentence(stripWakeAndHole(rawText), names);

    if (Object.keys(scores).length === 0) {
      debugLog('Heard wake word — waiting for scores...');
      const followUp = await listenForFollowUp(8000);
      if (followUp) {
        debugLog('Heard: ' + followUp);
        if (hole === null) hole = extractHoleNumber(followUp);
        scores = parseHoleSentence(stripWakeAndHole(followUp), names);
      }
    }

    if (hole === null) hole = getNextIncompleteHole();
    if (hole === null) {
      debugLog('✅ All 18 holes already complete.');
      await speak('All holes are already filled in.');
      qaActive = false;
      micIcon.style.display = 'none';
      return;
    }

    if (Object.keys(scores).length === 0) {
      debugLog('⚠️ Could not find any names or scores in that.');
      await speak("I didn't catch any scores. Please try again.");
      qaActive = false;
      micIcon.style.display = 'none';
      return;
    }

    fillScoresWithHighlight(hole, scores);
    debugLog('✅ Hole ' + hole + ' — collected: ' + JSON.stringify(scores));

    const missingNames = names.filter((_, i) => scores[i] === undefined);
    let msg = 'Hole ' + hole + ' scores entered.';
    if (missingNames.length) msg += ' Missing ' + missingNames.join(', ') + '.';
    await speak(msg);

    const winner = getSkinWinner(scores, names);
    if (winner) {
      await speak(winner);
      await playCaching();
    }

    qaActive = false;
    micIcon.style.display = 'none';
  }

  function buildRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = 'en-US';
    r.maxAlternatives = 3;

    r.onresult = function(event) {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.toLowerCase();

      if (qaActive) {
        // We're mid-processing (or speaking a confirmation) — ignore our own
        // audio feedback, UNLESS we're specifically waiting on a follow-up.
        if (qaResolveAnswer) qaResolveAnswer(transcript);
        return;
      }

      debugLog('Heard: ' + transcript);

      const hasTrigger = transcript.includes('birdiebookie') ||
        transcript.includes('birdie bookie') ||
        transcript.includes('birdie rookie') ||
        transcript.includes('birdie cookie') ||
        transcript.includes('birdie boogie');

      if (hasTrigger) {
        processUtterance(transcript);
      }
    };

    r.onerror = function(e) {
      debugLog('⚠️ Voice error: ' + e.error);
      if (qaResolveAnswer) qaResolveAnswer(null);
    };

    r.onend = function() {
      if (userWantsListening) {
        setTimeout(() => {
          if (userWantsListening) {
            try { recognition.start(); } catch(e) {}
          }
        }, 500);
      }
    };

    return r;
  }

  function updateToggleButton() {
    const btn = document.getElementById('voiceToggleBtn');
    if (!btn) return;
    if (userWantsListening) {
      btn.textContent = '🎙️ VOICE ENTRY: ON (tap to stop)';
      btn.style.background = '#00ff99';
      btn.style.color = 'black';
    } else {
      btn.textContent = '🎙️ VOICE SCORE ENTRY: OFF (tap to start)';
      btn.style.background = '#111';
      btn.style.color = '#00ff99';
    }
  }

  window.BBVoiceToggle = function() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice entry is not supported in this browser.');
      return;
    }

    if (!micIcon) micIcon = createMicIcon();
    if (!debugBox) debugBox = createDebugBox();

    if (userWantsListening) {
      userWantsListening = false;
      qaActive = false;
      qaResolveAnswer = null;
      if (recognition) {
        try { recognition.stop(); } catch(e) {}
      }
      micIcon.style.display = 'none';
      debugBox.style.display = 'none';
    } else {
      userWantsListening = true;
      recognition = buildRecognition();
      try { recognition.start(); } catch(e) {}
      debugLog('🎙️ Listening for "BirdieBookie hole 1 John 4 Sonny 4..."');
    }
    updateToggleButton();
  };

  // ---------------- BINGO BANGO BONGO INTEGRATION ----------------
  const BBB_KEY = 'birdiebookieBingoBongoRound';
  let bbbState = {
    pointValue: 1,
    round: Array.from({length:18}, () => ({ bingo:null, bango:null, bongo:null }))
  };

  function bbbIsSelected() {
    try {
      const games = JSON.parse(localStorage.getItem('selectedGames') || '[]');
      return games.some(g => String(g).includes('Bingo Bango Bongo'));
    } catch(e) {
      return false;
    }
  }

  function loadBBBState() {
    try {
      const saved = JSON.parse(localStorage.getItem(BBB_KEY) || 'null');
      if (!saved) return;
      if (saved.pointValue) bbbState.pointValue = Number(saved.pointValue) || 1;
      if (Array.isArray(saved.round) && saved.round.length === 18) {
        bbbState.round = saved.round.map(h => ({
          bingo: h && h.bingo !== undefined ? h.bingo : null,
          bango: h && h.bango !== undefined ? h.bango : null,
          bongo: h && h.bongo !== undefined ? h.bongo : null
        }));
      }
    } catch(e) {}
  }

  function saveBBBState() {
    localStorage.setItem(BBB_KEY, JSON.stringify({
      pointValue: bbbState.pointValue,
      players: getPlayerNames(),
      round: bbbState.round
    }));
  }

  function getBBBPoints() {
    const points = [0,0,0,0];
    bbbState.round.forEach(hole => {
      ['bingo','bango','bongo'].forEach(type => {
        const winner = hole[type];
        if (winner !== null && winner !== undefined && winner >= 0 && winner < 4) points[winner] += 1;
      });
    });
    return points;
  }

  function getBBBMoney() {
    const points = getBBBPoints();
    const totalPoints = points.reduce((a,b) => a+b, 0);
    if (!totalPoints) return [0,0,0,0];
    const avg = totalPoints / 4;
    return points.map(p => (p - avg) * bbbState.pointValue);
  }

  function escapeBBB(text) {
    return String(text).replace(/[&<>\"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];
    });
  }

  function createBBBSection() {
    if (document.getElementById('bbBingoBangoBongoSection')) return document.getElementById('bbBingoBangoBongoSection');

    const section = document.createElement('section');
    section.id = 'bbBingoBangoBongoSection';
    section.style.cssText = 'margin:30px 0; padding:20px; background:#050505; border:3px solid #00ff99; border-radius:16px; overflow-x:auto;';
    section.innerHTML = `
      <h1 style="color:#00ff99; text-align:center; margin:0 0 8px 0;">🎯 BINGO BANGO BONGO</h1>
      <div style="text-align:center; color:#ccc; margin-bottom:14px;">Three points are available on every hole. <b style="color:#ffdd44;">The player farthest from the hole plays first.</b></div>
      <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; align-items:center; margin-bottom:12px;">
        <span style="color:#ffdd44; font-weight:bold;">POINT VALUE:</span>
        <button type="button" class="bbb-value-btn" data-bbb-value="1">$1</button>
        <button type="button" class="bbb-value-btn" data-bbb-value="5">$5</button>
        <button type="button" class="bbb-value-btn" data-bbb-value="10">$10</button>
        <button type="button" class="bbb-value-btn" data-bbb-value="25">$25</button>
        <button type="button" class="bbb-value-btn" data-bbb-value="50">$50</button>
        <button type="button" class="bbb-value-btn" data-bbb-value="100">$100</button>
      </div>
      <div style="text-align:center; color:#ffdd44; font-size:14px; margin-bottom:16px;">Money is settled by point differential at the end of the round.</div>
      <div id="bbbSummary" style="display:grid; grid-template-columns:repeat(4,minmax(150px,1fr)); gap:8px; margin-bottom:16px;"></div>
      <div id="bbbHoles"></div>
    `;

    const mainCore = document.getElementById('mainScorecardCore');
    if (mainCore && mainCore.parentNode) mainCore.parentNode.insertBefore(section, mainCore.nextSibling);
    else document.body.appendChild(section);

    section.querySelectorAll('.bbb-value-btn').forEach(btn => {
      btn.style.cssText = 'background:#111;color:#00ff99;border:2px solid #00ff99;border-radius:20px;padding:7px 14px;font-weight:bold;cursor:pointer;';
      btn.addEventListener('click', function() {
        bbbState.pointValue = Number(this.dataset.bbbValue) || 1;
        saveBBBState();
        updateBBBSection();
        if (typeof window.updateLeaderboard === 'function') window.updateLeaderboard();
      });
    });

    return section;
  }

  function renderBBBHoles() {
    const holesEl = document.getElementById('bbbHoles');
    if (!holesEl) return;
    const names = getPlayerNames();
    let html = '';
    for (let h = 0; h < 18; h++) {
      html += `<div style="background:#111;border:1px solid #333;border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="color:#00ff99;font-weight:bold;font-size:18px;margin-bottom:8px;">HOLE ${h+1}</div>`;
      ['bingo','bango','bongo'].forEach(type => {
        const label = type.toUpperCase();
        html += `<div style="display:grid;grid-template-columns:80px 1fr;gap:8px;align-items:center;margin:6px 0;">
          <div style="color:#ffdd44;font-weight:bold;">${label}</div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(100px,1fr));gap:6px;">`;
        for (let p = 0; p < 4; p++) {
          html += `<button type="button" class="bbb-player-btn" data-bbb-hole="${h}" data-bbb-type="${type}" data-bbb-player="${p}" style="background:#000;color:#fff;border:1px solid #555;border-radius:8px;padding:8px;cursor:pointer;font-weight:bold;">${escapeBBB(names[p])}</button>`;
        }
        html += `</div></div>`;
      });
      html += `</div>`;
    }
    holesEl.innerHTML = html;
    holesEl.querySelectorAll('.bbb-player-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const h = Number(this.dataset.bbbHole);
        const type = this.dataset.bbbType;
        const p = Number(this.dataset.bbbPlayer);
        bbbState.round[h][type] = bbbState.round[h][type] === p ? null : p;
        saveBBBState();
        updateBBBSection();
        if (typeof window.updateLeaderboard === 'function') window.updateLeaderboard();
      });
    });
  }

  function updateBBBNames() {
    const names = getPlayerNames();
    document.querySelectorAll('.bbb-player-btn').forEach(btn => {
      const p = Number(btn.dataset.bbbPlayer);
      if (!isNaN(p) && names[p]) btn.textContent = names[p];
    });
  }

  function updateBBBSection() {
    const section = document.getElementById('bbBingoBangoBongoSection');
    if (!section) return;
    const active = bbbIsSelected();
    section.style.display = active ? 'block' : 'none';
    if (!active) return;

    section.querySelectorAll('.bbb-value-btn').forEach(btn => {
      const activeValue = Number(btn.dataset.bbbValue) === bbbState.pointValue;
      btn.style.background = activeValue ? '#00ff99' : '#111';
      btn.style.color = activeValue ? '#000' : '#00ff99';
    });

    updateBBBNames();

    const points = getBBBPoints();
    const money = getBBBMoney();
    const names = getPlayerNames();
    const summary = document.getElementById('bbbSummary');
    if (summary) {
      summary.innerHTML = names.map((name, i) => {
        const net = money[i];
        const color = net > 0.004 ? '#00ff66' : (net < -0.004 ? '#ff4444' : '#fff');
        const sign = net > 0 ? '+' : '';
        return `<div style="background:#000;border:2px solid ${color};border-radius:10px;padding:8px;text-align:center;font-weight:bold;">
          <div style="color:#fff;">${escapeBBB(name)}</div>
          <div style="color:#ffdd44;">${points[i]} pts</div>
          <div style="color:${color};">${sign}$${net.toFixed(2)}</div>
        </div>`;
      }).join('');
    }

    document.querySelectorAll('.bbb-player-btn').forEach(btn => {
      const h = Number(btn.dataset.bbbHole);
      const type = btn.dataset.bbbType;
      const p = Number(btn.dataset.bbbPlayer);
      const selected = bbbState.round[h][type] === p;
      btn.style.background = selected ? '#00ff99' : '#000';
      btn.style.color = selected ? '#000' : '#fff';
      btn.style.borderColor = selected ? '#00ff99' : '#555';
    });
  }

  function applyBBBToLeaderboard() {
    if (!bbbIsSelected()) return;
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    const names = getPlayerNames();
    const bbbMoney = getBBBMoney();
    const base = [0,0,0,0];
    const spans = Array.from(list.querySelectorAll('.leaderboard-item'));

    spans.forEach((span, index) => {
      const text = span.textContent.trim();
      const match = text.match(/(-?)\$(\d+(?:\.\d+)?)\s*$/);
      if (!match) return;
      const amount = parseFloat(match[2]) * (match[1] === '-' ? -1 : 1);
      const name = text.replace(/\s*(-?)\$(\d+(?:\.\d+)?)\s*$/, '').trim();
      const idx = names.indexOf(name);
      if (idx >= 0) base[idx] = amount;
      else if (index < 4) base[index] = amount;
    });

    const combined = names.map((name, i) => ({ name, total: base[i] + bbbMoney[i] }));
    combined.sort((a,b) => b.total - a.total);

    function fmt(n) {
      const sign = n < -0.004 ? '-' : '';
      const abs = Math.abs(n);
      const shown = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(2);
      return sign + '$' + shown;
    }

    list.innerHTML = combined.map(p => {
      const cls = p.total > 0.004 ? 'leaderboard-win' : (p.total < -0.004 ? 'leaderboard-lose' : 'leaderboard-even');
      return `<span class="leaderboard-item ${cls}">${escapeBBB(p.name)} ${fmt(p.total)}</span>`;
    }).join('');
  }

  function installBBBLeaderboardHook() {
    if (typeof window.updateLeaderboard === 'function' && !window.updateLeaderboard.__bbbHooked) {
      const original = window.updateLeaderboard;
      const wrapped = function() {
        original.apply(this, arguments);
        try { applyBBBToLeaderboard(); } catch(e) { console.error(e); }
      };
      wrapped.__bbbHooked = true;
      window.updateLeaderboard = wrapped;
    }
  }

  function installBBBCloudHooks() {
    if (typeof window.collectRoundDataForCloud === 'function' && !window.collectRoundDataForCloud.__bbbHooked) {
      const originalCollect = window.collectRoundDataForCloud;
      const wrappedCollect = function() {
        const data = originalCollect.apply(this, arguments);
        data.bingoBangoBongo = JSON.parse(JSON.stringify(bbbState));
        return data;
      };
      wrappedCollect.__bbbHooked = true;
      window.collectRoundDataForCloud = wrappedCollect;
    }

    if (typeof window.applyCloudRoundData === 'function' && !window.applyCloudRoundData.__bbbHooked) {
      const originalApply = window.applyCloudRoundData;
      const wrappedApply = function(data) {
        originalApply.apply(this, arguments);
        if (data && data.bingoBangoBongo) {
          bbbState = JSON.parse(JSON.stringify(data.bingoBangoBongo));
          saveBBBState();
          updateBBBSection();
          applyBBBToLeaderboard();
        }
      };
      wrappedApply.__bbbHooked = true;
      window.applyCloudRoundData = wrappedApply;
    }
  }

  function initBBBIntegration() {
    loadBBBState();
    createBBBSection();
    renderBBBHoles();
    updateBBBSection();

    document.querySelectorAll('.player-input').forEach(input => {
      input.addEventListener('input', function() {
        updateBBBNames();
        saveBBBState();
        updateBBBSection();
        if (typeof window.updateLeaderboard === 'function') window.updateLeaderboard();
      });
    });

    installBBBLeaderboardHook();
    installBBBCloudHooks();
    if (typeof window.updateLeaderboard === 'function') window.updateLeaderboard();
  }

  setTimeout(initBBBIntegration, 0);

})();
