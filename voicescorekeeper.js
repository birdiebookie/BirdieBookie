(function () {

  const wordToNum = {
    'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,
    'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
    'eleven':11,'twelve':12,
    'for':4,'fore':4,'ford':4,'too':2,
    '0':0,'1':1,'2':2,'3':3,'4':4,
    '5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'11':11,'12':12
  };

  function parseSpokenNumber(text) {
    if (!text) return NaN;
    const t = text.toLowerCase();
    const tokens = t.split(/\s+/);
    for (const tok of tokens) {
      const cleaned = tok.replace(/[^a-z0-9]/g, '');
      if (wordToNum[cleaned] !== undefined) return wordToNum[cleaned];
    }
    const digitMatch = t.match(/\d+/);
    if (digitMatch) return parseInt(digitMatch[0]);
    return NaN;
  }

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

  function listenForAnswer(timeoutMs) {
    return new Promise(resolve => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          qaResolveAnswer = null;
          resolve(null);
        }
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

  async function runScoreSession() {
    if (qaActive) return;
    qaActive = true;
    micIcon.style.display = 'block';

    const hole = getNextIncompleteHole();
    if (hole === null) {
      debugLog('✅ All 18 holes already complete.');
      await speak('All holes are already filled in.');
      qaActive = false;
      micIcon.style.display = 'none';
      return;
    }

    debugLog('🏌️ Starting score entry for hole ' + hole);
    const names = getPlayerNames();
    const scores = {};

    for (let i = 0; i < 4; i++) {
      await speak(`What was ${names[i]}'s score?`);
      const answer = await listenForAnswer(6000);
      if (answer === null) {
        debugLog('⚠️ No answer heard for ' + names[i] + ' — leaving blank.');
        continue;
      }
      debugLog('Heard answer for ' + names[i] + ': ' + answer);
      const num = parseSpokenNumber(answer);
      if (isNaN(num)) {
        debugLog('⚠️ Could not understand answer for ' + names[i] + ': "' + answer + '" — leaving blank.');
        continue;
      }
      scores[i] = num;
    }

    debugLog('✅ Hole ' + hole + ' — collected: ' + JSON.stringify(scores));
    fillScoresWithHighlight(hole, scores);

    await speak('Scores entered.');

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
      let transcripts = [];
      for (let i = 0; i < result.length; i++) {
        transcripts.push(result[i].transcript.toLowerCase());
      }
      const transcript = transcripts[0];
      debugLog('Heard: ' + transcript);

      if (qaActive) {
        if (qaResolveAnswer) qaResolveAnswer(transcript);
        return;
      }

      const hasTrigger = transcripts.some(t =>
        t.includes('birdiebookie') ||
        t.includes('birdie bookie') ||
        t.includes('birdie rookie') ||
        t.includes('birdie cookie') ||
        t.includes('birdie boogie')
      );

      if (hasTrigger) {
        runScoreSession();
      }
    };

    r.onerror = function(e) {
      debugLog('⚠️ Voice error: ' + e.error);
      if (qaActive) {
        if (qaResolveAnswer) qaResolveAnswer(null);
      }
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
      debugLog('🎙️ Listening for "Hey BirdieBookie"...');
    }
    updateToggleButton();
  };

})();
