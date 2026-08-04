let audioCtx = null;
let micStream = null;
let micSourceNode = null;
let mrSourceNode = null;
let dryGainNode = null;
let wetGainNode = null;
let delayNode = null;
let feedbackGain = null;
let mediaRecorder = null;
let recordedChunks = [];
let isAudioLoaded = false;

function extractVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// 1. 하이브리드 음원 불러오기
async function loadYoutubeKaraoke() {
  const urlInput = document.getElementById('ytUrlInput');
  const status = document.getElementById('recStatus');
  
  if (!urlInput || !status) return;

  const url = urlInput.value.trim();
  if (!url) {
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 주소를 입력 칸에 붙여넣어 보세요.";
    return;
  }

  isAudioLoaded = false;
  status.style.color = "#3b52d4";
  status.innerText = "🎬 음원 파이프라인 연결을 시도 중입니다...";

  const audioPlayer = document.getElementById('internalAudioPlayer');
  const videoId = extractVideoId(url);

  // [방식 A] 직렬 MP3 링크일 경우 (가장 확실한 100% 가동)
  if (!videoId && (url.startsWith('http://') || url.startsWith('https://'))) {
    try {
      audioPlayer.src = url;
      isAudioLoaded = true;
      status.style.color = "#10b981";
      status.innerText = "🟢 직렬 음원 연결 완료! [반주 재생 & 녹음 시작]을 누르세요.";
    } catch (e) {
      status.style.color = "#ef4444";
      status.innerText = "⚠️ 입력한 음원 링크를 읽을 수 없습니다.";
    }
    return;
  }

  // [방식 B] 유튜브 주소일 경우
  if (videoId) {
    const iframe = document.getElementById('ytIframe');
    iframe.src = "https://www.youtube.com/embed/" + videoId + "?enablejsapi=1&mute=1";
    document.getElementById('videoContainer').style.display = "block";
    document.getElementById('ytFallbackBtn').style.display = "block";

    // 1차 추출 서버 시도
    try {
      const res = await fetch('https://pipedapi.kavin.rocks/streams/' + videoId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.audioStreams && data.audioStreams.length > 0) {
          audioPlayer.src = data.audioStreams[0].url;
          isAudioLoaded = true;
          status.style.color = "#10b981";
          status.innerText = "🟢 반주 연결 완료! [반주 재생 & 녹음 시작]을 누르세요.";
          return;
        }
      }
    } catch (err) {}

    // 2차 백업 추출 서버 시도
    try {
      const res2 = await fetch('https://api.piped.privacydev.net/streams/' + videoId);
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.audioStreams && data2.audioStreams.length > 0) {
          audioPlayer.src = data2.audioStreams[0].url;
          isAudioLoaded = true;
          status.style.color = "#10b981";
          status.innerText = "🟢 백업 서버 연결 완료! [반주 재생 & 녹음 시작]을 누르세요.";
          return;
        }
      }
    } catch (e2) {}

    // 서버 추출 실패 시 원인 안내
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 외부 추출 서버가 구글에 의해 차단되었습니다. 다른 유튜브 링크나 직렬 MP3 링크를 사용해 보세요.";
  } else {
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 올바른 주소 형식이 아닙니다.";
  }
}

function openYtWindow() {
  const urlInput = document.getElementById('ytUrlInput');
  if (urlInput && urlInput.value.trim()) {
    window.open(urlInput.value.trim(), '_blank');
  }
}

// 2. 오디오 엔진 이니셜라이징
async function initAudioEngine() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micSourceNode = audioCtx.createMediaStreamSource(micStream);

    dryGainNode = audioCtx.createGain();
    dryGainNode.gain.value = 1.8;

    delayNode = audioCtx.createDelay();
    delayNode.delayTime.value = 0.12;

    feedbackGain = audioCtx.createGain();
    feedbackGain.gain.value = 0.35;

    wetGainNode = audioCtx.createGain();

    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);

    micSourceNode.connect(dryGainNode);
    micSourceNode.connect(delayNode);
    delayNode.connect(wetGainNode);

    const audioPlayer = document.getElementById('internalAudioPlayer');
    mrSourceNode = audioCtx.createMediaElementSource(audioPlayer);

    updateReverb(document.getElementById('reverbRange').value);
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

function updateReverb(val) {
  const textElem = document.getElementById('reverbValText');
  if (textElem) textElem.innerText = val + '%';
  if (wetGainNode) {
    wetGainNode.gain.value = (val / 100) * 0.6;
  }
}

// 3. 녹음 제어
async function startRecording() {
  const status = document.getElementById('recStatus');
  const audioPlayer = document.getElementById('internalAudioPlayer');
  const iframe = document.getElementById('ytIframe');

  if (!isAudioLoaded) {
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 반주가 수신되지 않았습니다. 다른 음원 링크를 입력해 보세요.";
    return;
  }

  try {
    await initAudioEngine();

    mrSourceNode.connect(audioCtx.destination);

    const dest = audioCtx.createMediaStreamDestination();
    mrSourceNode.connect(dest);
    dryGainNode.connect(dest);
    wetGainNode.connect(dest);

    mediaRecorder = new MediaRecorder(dest.stream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(blob);
      document.getElementById('audioPreview').src = audioUrl;
      document.getElementById('btnDownloadAudio').href = audioUrl;
      document.getElementById('recResultBox').style.display = "block";
    };

    mediaRecorder.start();

    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    }
    audioPlayer.currentTime = 0;
    audioPlayer.play();

    document.getElementById('btnRecStart').style.display = "none";
    document.getElementById('btnRecStop').style.display = "inline-block";
    status.style.color = "#ef4444";
    status.innerText = "🔴 편하게 노래를 불러보세요! (녹음 진행 중)";

  } catch (err) {
    alert("마이크 접속 실패: " + err.message);
  }
}

function stopRecording() {
  const audioPlayer = document.getElementById('internalAudioPlayer');
  const iframe = document.getElementById('ytIframe');

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
  }
  audioPlayer.pause();

  document.getElementById('btnRecStart').style.display = "inline-block";
  document.getElementById('btnRecStop').style.display = "none";

  const status = document.getElementById('recStatus');
  status.style.color = "#10b981";
  status.innerText = "🟢 녹음 완료! 하단 플레이어에서 완성본을 확인해 보세요.";
}
