// ============================
// BIRDIEBOOKIE VOICE SCOREKEEPER
// Say "HEY BIRDIEBOOKIE hole 3 [name] 4 [name] 3 [name] 5 [name] 4"
// ============================

(function () {

  // --- Cash register sound (generated via Web Audio API, no file needed) ---
  function playCaching() {
    return new Promise(resolve => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      function beep(freq, start, duration, gain) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'square';
        gainNode.gain.setValueAtTime(gain, ctx.currentTime + start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      }

      // Cash register "cha-ching" sound pattern
      beep(1200, 0.00, 0.05, 0.3);
      beep(800,  0.05, 0.05, 0.3);
      beep(1500, 0.10, 0.08, 0.4);
      beep(1000, 0.18, 0.15, 0.3);

      setTimeout(resolve, 400);
    });
  }

  async function playCachingTimes(n) {
    for (let i = 0; i < n; i++) {
      await playCaching();
      await new Promise(r => setTimeout(r, 150));
    }
  }

  // --- Text to speech ---
  function speak(text) {
    return new Promise(resolve => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1.1;
      utter.volume = 1;
      utter.onend = resolve;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });
  }

  // --- Get current player names from scorecard ---
  function getPlayerNames() {
    return [
      document.getElementById('name1')?.value?.trim() || 'Player 1',
      document.getElementById('name2')?.value?.trim() || 'Player 2',
      document.getElementById('name3')?.value?.trim() || 'Player 3',
      document.getElementById('name4')?.value?.trim() || 'Player 4',
    ];
  }

  // --- Word to number conversion ---
  const wordToNum = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10
  };

  function parseNumber(word) {
    return wordToNum[word?.toLowerCase()] ?? parseInt(word);
  }

  // --- Parse voice transcript ---
  // Expected: "hey birdiebookie hole 3 mark 4 terry 3 sonny 5 john 4"
  function parseTranscript(transcript, names) {
    const lower = transcript.toLowerCase();

    // Must contain trigger
    if (!lower.includes('hey birdiebookie') && !lower.includes('birdiebookie')) return null;

    // Extract hole number
    const holeMatch = lower.match(/(?:hole|whole|coal|roll)\s+(\w+)/);
    if (!holeMatch) return null;
    const holeNum = parseNumber(holeMatch[1]);
    if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) return null;

    // Try to match each player name to a score
    const scores = {};
    for (let i = 0; i < names.length; i++) {
      const name = names[i].toLowerCase();
      // Look for name followed by a number word
      const regex = new RegExp(name + '\\s+(\\w+)', 'i');
      const match = lower.match(regex);
      if (match) {
        const score = parseNumber(match[1]);
        if (!isNaN(score)) scores[i] = score;
      }
    }

    if (Object.keys(scores).length === 0) return null;
    return { holeNum, scores };
  }

  // --- Fill scores into scorecard ---
  // Each player row has 21 hole-box inputs:
  // 0-8 = holes 1-9, 9 = OUT, 10-18 = holes 10-18, 19 = IN, 20 = TOT
  function holeToIndex(holeNum) {
    if (holeNum >= 1 && holeNum <= 9) return holeNum - 1;
    if (holeNum >= 10 && holeNum <= 18) return holeNum; // +1 for OUT slot
    return null;
  }

  function fillScores(holeNum, scores) {
    const playerIds = ['player1', 'player2', 'player3', 'player4'];
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

  // --- Check who won the skin on this hole ---
  function getSkinWinner(holeNum, scores, names) {
    const entries = Object.entries(scores).map(([i, s]) => ({ i: parseInt(i), score: s }));
    if (entries.length < 2) return null;
    const min = Math.min(...entries.map(e => e.score));
    const winners = entries.filter(e => e.score === min);
    if (winners.length === 1) return names[winners[0].i];
    return null; // tie
  }

  // --- Count carried holes for skin celebration ---
  function countCarryover(holeNum) {
    // Look back to find how many consecutive tied holes before this one
    let count = 1;
    const playerIds = ['player1', 'player2', 'player3', 'player4'];

    for (let h = holeNum - 1; h >= 1; h--) {
      const idx = holeToIndex(h);
      const vals = playerIds.map(id => {
        const boxes = document.querySelectorAll('#' + id + ' .hole-box');
        return parseInt(boxes[idx]?.value);
      }).filter(v => !isNaN(v));
      if (vals.length < 2) break;
      const min = Math.min(...vals);
      const tied = vals.filter(v => v === min).length > 1;
      if (tied) count++;
      else break;
    }
    return count;
  }

  // --- Mic icon ---
  function createMicIcon() {
    const mic = document.createElement('div');
    mic.id = 'bb-mic-icon';
    mic.innerHTML = '🎤';
    mic.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      font-size: 48px;
      display: none;
      z-index: 9999;
      background: rgba(0,0,0,0.7);
      border-radius: 50%;
      width: 80px;
      height: 80px;
      line-height: 80px;
      text-align: center;
      border: 3px solid #00ff99;
      animation: pulse 1s infinite;
    `;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0,255,153,0.7); }
        70% { box-shadow: 0 0 0 20px rgba(0,255,153,0); }
        100% { box-shadow: 0 0 0 0 rgba(0,255,153,0); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(mic);
    return mic;
  }

  // --- Main voice recognition setup ---
  function startVoiceScorekeeper() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('BirdieBookie Voice: Speech recognition not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    const micIcon = createMicIcon();
    let processing = false;

    recognition.onresult = async function (event) {
      if (processing) return;
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log('BirdieBookie heard:', transcript);

      const lower = transcript.toLowerCase();
      if (!lower.includes('birdiebookie')) return;

      processing = true;
      micIcon.style.display = 'block';

      const names = getPlayerNames();
      const parsed = parseTranscript(transcript, names);

      if (!parsed) {
        await speak('Sorry, I did not understand. Please try again.');
        micIcon.style.display = 'none';
        processing = false;
        return;
      }

      const { holeNum, scores } = parsed;

      // Fill scores into card
      fillScores(holeNum, scores);

      // Build confirmation speech
      const scoreText = Object.entries(scores)
        .map(([i, s]) => `${names[i]} ${s}`)
        .join(', ');
      await speak(`Hole ${holeNum} confirmed. ${scoreText}`);

      // Check for skin winner
      const winner = getSkinWinner(holeNum, scores, names);
      if (winner) {
        const carryovers = countCarryover(holeNum);
        await speak(winner);
        await playCachingTimes(carryovers);
      }

      micIcon.style.display = 'none';
      processing = false;
    };

    recognition.onerror = function (e) {
      console.warn('BirdieBookie Voice error:', e.error);
      if (e.error !== 'no-speech') {
        setTimeout(() => recognition.start(), 1000);
      }
    };

    recognition.onend = function () {
      // Auto-restart to keep always-on
      setTimeout(() => recognition.start(), 500);
    };

    recognition.start();
    console.log('BirdieBookie Voice Scorekeeper is listening...');
  }

  // Start when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startVoiceScorekeeper);
  } else {
    startVoiceScorekeeper();
  }

})();
