(function () {

  const wordToNum = {
    'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,
    'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
    'eleven':11,'twelve':12,'0':0,'1':1,'2':2,'3':3,'4':4,
    '5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'11':11,'12':12
  };

  function parseNumber(word) {
    if (!word) return NaN;
    const w = word.toLowerCase();
    if (wordToNum[w] !== undefined) return wordToNum[w];
    return parseInt(w);
  }

  function speak(text) {
    return new Promise(resolve => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.onend = resolve;
      window.speechSynthesis.speak(u);
    });
  }

  function playCaching() {
    return new Promise(resolve => {
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
    });
  }

  async function playCachingTimes(n) {
    for (let i = 0; i < n; i++) {
      await playCaching();
      await new Promise(r => setTimeout(r, 150));
    }
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

  function fillScores(holeNum, scores) {
    const playerIds = ['player1','player2','player3','player4'];
    const idx = holeToIndex(holeNum);
    if (idx === null) return;
    for (const [i, score] of Object.entries(scores)) {
      const boxes = document.querySelectorAll('#' + playerIds[i] + ' .hole-box');
      if (boxes[idx]) {
        boxes[idx].value = score;
        boxes[idx].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  function getSkinWinner(scores, names) {
    const entries = Object.entries(scores).map(([i, s]) => ({ i: parseInt(i), score: s }));
    if (entries.length < 2) return null;
    const min = Math.min(...entries.map(e => e.score));
    const winners = entries.filter(e => e.score === min);
    if (winners.length === 1) return names[winners[0].i];
    return null;
  }

  // --- Mic icon ---
  function createMicIcon() {
    const mic = document.createElement('div');
    mic.id = 'bb-mic-icon';
    mic.innerHTML = '🎤';
    mic.style.cssText = `
      position:fixed; bottom:30px; right:30px; font-size:48px;
      display:none; z-index:9999; background:rgba(0,0,0,0.7);
      border-radius:50%; width:80px; height:80px; line-height:80px;
      text-align:center; border:3px solid #00ff99;
    `;
    document.body.appendChild(mic);
    return mic;
  }

  function startListening() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice not supported. Please use Chrome.');
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    const micIcon = createMicIcon();
    let buffer = '';
    let bufferTimer = null;
    let processing = false;

    async function processBuffer(text) {
      if (processing) return;
      processing = true;
      micIcon.style.display = 'block';

      const lower = text.toLowerCase();
      const names = getPlayerNames();

      // Extract hole number - accept "hole" or "whole" or "coal" or "roll" or "goal"
      const holeMatch = lower.match(/(?:hole|whole|coal|roll|goal)\s+(\w+)/);
      if (!holeMatch) {
        await speak('I did not catch the hole number. Please try again.');
        micIcon.style.display = 'none';
        processing = false;
        buffer = '';
        return;
      }

      const holeNum = parseNumber(holeMatch[1]);
      if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) {
        await speak('Invalid hole number. Please try again.');
        micIcon.style.display = 'none';
        processing = false;
        buffer = '';
        return;
      }

      // Match player names to scores
      const scores = {};
      for (let i = 0; i < names.length; i++) {
        const name = names[i].toLowerCase();
        const regex = new RegExp(name + '[\\s,]+([\\w]+)', 'i');
        const match = lower.match(regex);
        if (match) {
          const score = parseNumber(match[1]);
          if (!isNaN(score)) scores[i] = score;
        }
      }

      if (Object.keys(scores).length === 0) {
        await speak('I did not catch any scores. Please try again.');
        micIcon.style.display = 'none';
        processing = false;
        buffer = '';
        return;
      }

      // Fill scores
      fillScores(holeNum, scores);

      // Confirm
      const scoreText = Object.entries(scores)
        .map(([i, s]) => `${names[i]} ${s}`)
        .join(', ');
      await speak(`Hole ${holeNum} confirmed. ${scoreText}`);

      // Skin winner cha-ching
      const winner = getSkinWinner(scores, names);
      if (winner) {
        await speak(winner);
        await playCachingTimes(1);
      }

      micIcon.style.display = 'none';
      processing = false;
      buffer = '';
    }

    recognition.onresult = function (event) {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log('BirdieBookie heard:', transcript);

      const lower = transcript.toLowerCase();

      // Check for trigger word
      if (lower.includes('birdiebookie') || lower.includes('birdie bookie')) {
        buffer = transcript;
        if (bufferTimer) clearTimeout(bufferTimer);
        bufferTimer = setTimeout(() => {
          if (buffer) processBuffer(buffer);
        }, 3000);
        return;
      }

      // Check for ENTER SCORES end command
      if (lower.includes('enter scores') || lower.includes('enter score')) {
        if (buffer) {
          if (bufferTimer) clearTimeout(bufferTimer);
          processBuffer(buffer);
        }
        return;
      }

      // Accumulate into buffer if we already heard the trigger
      if (buffer) {
        buffer += ' ' + transcript;
        if (bufferTimer) clearTimeout(bufferTimer);
        bufferTimer = setTimeout(() => {
          if (buffer) processBuffer(buffer);
        }, 3000);
      }
    };

    recognition.onerror = function (e) {
      console.warn('Voice error:', e.error);
    };

    recognition.onend = function () {
      setTimeout(() => {
        try { recognition.start(); } catch(e) {}
      }, 1000);
    };

    recognition.start();
    console.log('BirdieBookie Voice Scorekeeper is listening...');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startListening);
  } else {
    startListening();
  }

})();
