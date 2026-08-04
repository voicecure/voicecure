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

// 1. 모바일 대응 반주 수신
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

  status.style.color = "#3b52d4";
  status.innerText = "🎬 모바일 음원 파이프라인 연결 중...";

  const videoId = extractVideoId(url);
  const audioPlayer = document.getElementById('internalAudioPlayer');
  
  // 모바일 재생 필수 속성 부여
  audioPlayer.setAttribute('playsinline', 'true');

  if (!videoId && (url.startsWith('http://') || url.startsWith('https://'))) {
    try {
      audioPlayer.src = url;
      isAudioLoaded = true;

      status.style.color = "#10b981";
      status.innerText = "🟢 음원 연결 완료! [반주 재생 & 녹음 시작]을 누르세요.";
    } catch (e) {
      status.style.color = "#ef4444";
      status.innerText = "⚠️ 입력한 음원 링크를 읽을 수 없습니다.";
    }
    return;
  }

  if (videoId) {
    const iframe = document.getElementById('ytIframe');
    iframe.src = "https://www.youtube.com/embed/" + videoId + "?enablejsapi=1&mute=1";
    document.getElementById('videoContainer').style.display = "block";
    document.getElementById('ytFallbackBtn').style.display = "block";

    try {
      const res = await fetch('https://pipedapi.kavin.rocks/streams/' + videoId);
      const data = await res.json();
      
      if (data && data.audioStreams && data.audioStreams.length > 0) {
        audioPlayer.src = data.audioStreams[0].url;
        isAudioLoaded = true;

        status.style.color = "#10b981";
        status.innerText = "🟢 반주 준비 완료! [반주 재생 & 녹음 시작]을 누르세요.";
        return;
      }
    } catch (err) {
      try {
        const res2 = await fetch('https://api.piped.privacydev.net/streams/' + videoId);
        const data2 = await res2.json();
        if (data2 && data2.audioStreams && data2.audioStreams.length > 0) {
          audioPlayer.src = data2.audioStreams[0].url;
          isAudioLoaded = true;

          status.style.color = "#10b981";
          status.innerText = "🟢 백업 연결 완료! [반주 재생 & 녹음 시작]을 누르세요.";
          return;
        }
      } catch (e2) {}
    }

    status.style.color = "#ef4444";
    status.innerText = "⚠️ 모바일 보안 정책으로 인해 해당 음원을 가져올 수 없습니다.";
  }
}

function openYtWindow() {
  const urlInput = document.getElementById('ytUrlInput');
  if (urlInput && urlInput.value.trim()) {
    window.open(urlInput.value.trim(), '_blank');
  }
}

// 2. 모바일 터치 잠금 해제 포함 오디오 엔진
async function initAudioEngine() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      } 
    });
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
    
    // 모바일 CORS 보안 오류 방지 우회 처리
    try {
      mrSourceNode = audioCtx.createMediaElementSource(audioPlayer);
    } catch (e) {
      console.warn("모바일 미디어 세팅 우회 가동");
    }

    updateReverb(document.getElementById('reverbRange').value);
  }

  // 모바일 터치 잠금 해제
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

// 3. 동시 실행 녹음
async function startRecording() {
  const status = document.getElementById('recStatus');
  const audioPlayer = document.getElementById('internalAudioPlayer');
  const iframe = document.getElementById('ytIframe');

  if (!isAudioLoaded) {
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 먼저 주소를 넣고 [반주 불러오기]를 눌러주세요.";
    return;
  }

  try {
    // 터치 순간 즉시 오디오 엔진 활성화
    await initAudioEngine();

    if (mrSourceNode) {
      mrSourceNode.connect(audioCtx.destination);
    }

    const dest = audioCtx.createMediaStreamDestination();
    if (mrSourceNode) mrSourceNode.connect(dest);
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
    
    // 모바일 오디오 수동 재생 승인
    audioPlayer.currentTime = 0;
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("모바일 자동 재생 제한 승인 필요:", error);
      });
    }

    document.getElementById('btnRecStart').style.display = "none";
    document.getElementById('btnRecStop').style.display = "inline-block";
    status.style.color = "#ef4444";
    status.innerText = "🔴 편하게 노래를 불러보세요! (녹음 진행 중)";

  } catch (err) {
    alert("스마트폰 마이크 접근 실패: " + err.message + "\n(브라우저 마이크 권한을 허용해 보세요.)");
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
  status.innerText = "🟢 녹음 완료! 아래 플레이어에서 완성본을 확인해 보세요.";
}
