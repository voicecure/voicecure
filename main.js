// 오디오 제어 변수
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

// 1. 유튜브 ID 추출 함수
function extractVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// 2. 유튜브 노래방 영상 및 백그라운드 MR 불러오기
function loadYoutubeKaraoke() {
  const urlInput = document.getElementById('ytUrlInput');
  const status = document.getElementById('recStatus');
  
  if (!urlInput) {
    alert("입력창 요소를 찾을 수 없습니다.");
    return;
  }

  const url = urlInput.value.trim();
  const videoId = extractVideoId(url);

  if (!url || !videoId) {
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 올바른 유튜브 영상 주소를 입력 칸에 붙여넣어 보세요.";
    return;
  }

  status.style.color = "#3b52d4";
  status.innerText = "🎬 비디오 및 반주 음원 파이프라인 구성 중...";

  // 가사 화면 출력용 Iframe 세팅
  const iframe = document.getElementById('ytIframe');
  iframe.src = "https://www.youtube.com/embed/" + videoId + "?enablejsapi=1&mute=1";
  document.getElementById('videoContainer').style.display = "block";
  document.getElementById('ytFallbackBtn').style.display = "block";

  // 백그라운드 MP3 오디오 스트림 요청
  fetch('https://youtube-mp36.p.rapidapi.com/dl?id=' + videoId, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': 'b5f581e368msha99c2e70281c5fcp16d985jsn92c3f22f9f0c',
      'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'ok' || data.link) {
      const audioPlayer = document.getElementById('internalAudioPlayer');
      audioPlayer.src = data.link;
      isAudioLoaded = true;

      status.style.color = "#10b981";
      status.innerText = "🟢 반주가 가동 준비되었습니다! [반주 재생 & 녹음 시작]을 눌러보세요.";
    } else {
      status.style.color = "#ef4444";
      status.innerText = "⚠️ 해당 영상의 음원을 추출할 수 없습니다. 다른 유튜브 링크로 시도해 보세요.";
    }
  })
  .catch(err => {
    console.error("통신 에러:", err);
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 서버 통신 오류가 발생했습니다. 잠시 후 다시 시도해 보세요.";
  });
}

function openYtWindow() {
  const url = document.getElementById('ytUrlInput').value.trim();
  if (url) window.open(url, '_blank');
}

// 3. 오디오 회로 구성
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
  document.getElementById('reverbValText').innerText = val + '%';
  if (wetGainNode) {
    wetGainNode.gain.value = (val / 100) * 0.6;
  }
}

function toggleMonitoring() {
  const isChecked = document.getElementById('monitorToggle').checked;
  if (!audioCtx) return;
  
  if (isChecked) {
    dryGainNode.connect(audioCtx.destination);
    wetGainNode.connect(audioCtx.destination);
  } else {
    dryGainNode.disconnect(audioCtx.destination);
    wetGainNode.disconnect(audioCtx.destination);
  }
}

// 4. 녹음 시작
async function startRecording() {
  const status = document.getElementById('recStatus');
  const audioPlayer = document.getElementById('internalAudioPlayer');
  const iframe = document.getElementById('ytIframe');

  if (!isAudioLoaded) {
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 먼저 실제 유튜브 링크를 넣고 [반주 불러오기]를 눌러주세요.";
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

    setTimeout(() => {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      audioPlayer.currentTime = 0;
      audioPlayer.play();
    }, 120);

    document.getElementById('btnRecStart').style.display = "none";
    document.getElementById('btnRecStop').style.display = "inline-block";
    status.style.color = "#ef4444";
    status.innerText = "🔴 가사를 보며 노래를 불러보세요! (녹음 진행 중)";

  } catch (err) {
    alert("오디오 가동 실패: " + err.message);
  }
}

// 5. 녹음 정지
function stopRecording() {
  const audioPlayer = document.getElementById('internalAudioPlayer');
  const iframe = document.getElementById('ytIframe');

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
  audioPlayer.pause();

  document.getElementById('btnRecStart').style.display = "inline-block";
  document.getElementById('btnRecStop').style.display = "none";

  const status = document.getElementById('recStatus');
  status.style.color = "#10b981";
  status.innerText = "🟢 녹음 완료! 아래 플레이어에서 완성본을 확인해 보세요.";
}
