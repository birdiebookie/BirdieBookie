(function () {

  const wordToNum = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    for: 4,
    fore: 4,
    too: 2,
    to: 2,
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    "11": 11,
    "12": 12
  };

  let recognition = null;
  let micIcon = null;
  let userWantsListening = false;
  let voiceText = "";

  function getPlayerNames() {
    return [
      document.getElementById("name1")?.value?.trim() || "Player 1",
      document.getElementById("name2")?.value?.trim() || "Player 2",
      document.getElementById("name3")?.value?.trim() || "Player 3",
      document.getElementById("name4")?.value?.trim() || "Player 4"
    ];
  }

  function holeToIndex(holeNum) {
    if (holeNum >= 1 && holeNum <= 9) return holeNum - 1;
    if (holeNum >= 10 && holeNum <= 18) return holeNum;
    return null;
  }

  function getNextIncompleteHole() {
    const playerIds = ["player1", "player2", "player3", "player4"];

    for (let holeNum = 1; holeNum <= 18; holeNum++) {
      const idx = holeToIndex(holeNum);
      let complete = true;

      for (const playerId of playerIds) {
        const boxes = document.querySelectorAll(
          "#" + playerId + " .hole-box"
        );

        if (!boxes[idx] || boxes[idx].value.trim() === "") {
          complete = false;
          break;
        }
      }

      if (!complete) return holeNum;
    }

    return null;
  }

  function parseNumber(word) {
    const cleaned = String(word)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (wordToNum[cleaned] !== undefined) {
      return wordToNum[cleaned];
    }

    const number = parseInt(cleaned, 10);

    return isNaN(number) ? NaN : number;
  }

  function parseScores(text, names) {

    const tokens = text
      .toLowerCase()
      .replace(/[.,!?]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const playerNames = names.map(function(name) {
      return name.toLowerCase().split(/\s+/)[0];
    });

    const scores = {};

    for (let i = 0; i < tokens.length; i++) {

      const playerIndex =
        playerNames.findIndex(function(name) {
          return name && tokens[i] === name;
        });

      if (playerIndex === -1) continue;

      for (
        let j = i + 1;
        j < Math.min(i + 5, tokens.length);
        j++
      ) {

        const score = parseNumber(tokens[j]);

        if (!isNaN(score)) {
          scores[playerIndex] = score;
          break;
        }
      }
    }

    return scores;
  }

  function enterScores(holeNum, scores) {

    const playerIds = [
      "player1",
      "player2",
      "player3",
      "player4"
    ];

    const index = holeToIndex(holeNum);

    if (index === null) return;

    for (let i = 0; i < 4; i++) {

      if (scores[i] === undefined) continue;

      const boxes = document.querySelectorAll(
        "#" + playerIds[i] + " .hole-box"
      );

      if (!boxes[index]) continue;

      boxes[index].value = scores[i];

      boxes[index].dispatchEvent(
        new Event("input", { bubbles: true })
      );

      boxes[index].dispatchEvent(
        new Event("change", { bubbles: true })
      );
    }
  }

  function createMicIcon() {

    if (document.getElementById("bb-mic-icon")) {
      return document.getElementById("bb-mic-icon");
    }

    const mic = document.createElement("div");

    mic.id = "bb-mic-icon";
    mic.innerHTML = "🎤";

    mic.style.cssText = `
      position:fixed;
      bottom:30px;
      right:30px;
      width:70px;
      height:70px;
      line-height:70px;
      text-align:center;
      font-size:42px;
      background:#00ff99;
      border:3px solid #111;
      border-radius:50%;
      z-index:9999;
      display:none;
    `;

    document.body.appendChild(mic);

    return mic;
  }

  function updateToggleButton() {

    const button =
      document.getElementById("voiceToggleBtn");

    if (!button) return;

    if (userWantsListening) {

      button.textContent =
        "🎙️ VOICE ENTRY: ON (tap to stop)";

      button.style.background = "#00ff99";
      button.style.color = "black";

    } else {

      button.textContent =
        "🎙️ VOICE SCORE ENTRY: OFF (tap to start)";

      button.style.background = "#111";
      button.style.color = "#00ff99";
    }
  }

  function stopListening() {

    userWantsListening = false;

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }

    if (micIcon) {
      micIcon.style.display = "none";
    }

    updateToggleButton();
  }

  function processVoiceEntry() {

    const names = getPlayerNames();

    const hole = getNextIncompleteHole();

    if (hole === null) {
      stopListening();
      return;
    }

    const cleanedText = voiceText
      .replace(/\benter\s+scores?\b/gi, "")
      .trim();

    const scores =
      parseScores(cleanedText, names);

    if (Object.keys(scores).length === 0) {
      return;
    }

    enterScores(hole, scores);

    // The command "enter scores" means:
    // ENTER THE SCORES AND STOP LISTENING.
    stopListening();
  }

  function buildRecognition() {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return null;
    }

    const r = new SpeechRecognition();

    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.maxAlternatives = 3;

    r.onresult = function(event) {

      if (!userWantsListening) return;

      let latestText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {

        latestText +=
          " " +
          event.results[i][0].transcript;
      }

      latestText = latestText.trim();

      if (!latestText) return;

      voiceText +=
        " " + latestText;

      voiceText = voiceText.trim();

      if (
        /\benter\s+scores?\b/i.test(voiceText)
      ) {

        userWantsListening = false;

        try {
          r.stop();
        } catch (e) {}

        processVoiceEntry();
      }
    };

    r.onerror = function(event) {

      if (
        event.error === "no-speech" ||
        event.error === "aborted"
      ) {
        return;
      }

      stopListening();
    };

    r.onend = function() {

      if (!userWantsListening) {
        updateToggleButton();
      }
    };

    return r;
  }

  window.BBVoiceToggle = function() {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

      alert(
        "Voice entry is not supported in this browser."
      );

      return;
    }

    if (!micIcon) {
      micIcon = createMicIcon();
    }

    if (userWantsListening) {

      stopListening();
      return;
    }

    voiceText = "";
    userWantsListening = true;

    recognition = buildRecognition();

    if (!recognition) {
      stopListening();
      return;
    }

    micIcon.style.display = "block";

    try {
      recognition.start();
    } catch (e) {}

    updateToggleButton();
  };

  updateToggleButton();

})();
