// --- 0. 탭 전환 기능 ---
function switchTab(tabId, btnElem) {
  document.querySelectorAll('.tab-content').forEach(function(tab) {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  document.getElementById(tabId).classList.add('active');
  btnElem.classList.add('active');
}

// --- 1. 유튜브 음원 추출 기능 ---
function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function startYoutubeDownload() {
  const url = document.getElementById('youtubeUrl').value.trim();
  const status = document.getElementById('ytStatus');
  const videoId = extractVideoId(url);

  if(!videoId) {
    alert("올바른 유튜브 주소를 입력해 보세요.");
    return;
  }

  status.style.color = "#3b52d4";
  status.innerText = "음원 추출 진행 중...";

  fetch('https://youtube-mp36.p.rapidapi.com/dl?id=' + videoId, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': 'b5f581e368msha99c2e70281c5fcp16d985jsn92c3f22f9f0c',
      'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
    }
  })
  .then(res => res.json())
  .then(data => {
    if(data.status === 'ok' || data.link) {
      status.style.color = "#10b981";
      status.innerHTML = '<div style="margin-top:8px;"><a href="' + data.link + '" target="_blank" style="color:#3b52d4; font-weight:700; text-decoration:underline;">🎧 MP3 파일 다운로드 열기 ➔</a></div>';
    } else {
      status.style.color = "#ef4444";
      status.innerText = "추출에 실패했습니다.";
    }
  })
  .catch(() => {
    status.style.color = "#ef4444";
    status.innerText = "통신 오류가 발생했습니다.";
  });
}

// --- 2. 가사 빠른 검색 기능 ---
function searchLyrics(portal) {
  const kw = document.getElementById('lyricsKeyword').value.trim();
  if (!kw) {
    alert('검색할 곡명이나 아티스트를 입력해 보세요.');
    return;
  }
  const encoded = encodeURIComponent(kw + ' 가사');
  let target = portal === 'naver' 
    ? 'https://search.naver.com/search.naver?query=' + encoded 
    : 'https://www.melon.com/search/total/index.htm?q=' + encodeURIComponent(kw);
  window.open(target, '_blank');
}

// --- 3. 초저지연 오디오 엔진 (MR + 마이크 + 리버브) ---
let audioCtx = null;
let micStream = null;
let micSourceNode = null;
let delayNode = null;
let feedbackGain = null;
let wetGainNode = null;
let dryGainNode = null;
let mediaRecorder = null;
let recordedChunks = [];

// MR 반주 불러오기
function loadMrFile(input) {
  const file = input.files[0];
  if (file) {
    const mrPlayer = document.getElementById('mrPlayer');
    mrPlayer.src = URL.createObjectURL(file);
    mrPlayer.style.display = "block";
  }
}

// 레이턴시 최적화 오디오 회로 연결
async function initAudioEngine() {
  if (!audioCtx) {
    // 1. 초저지연(interactive) 모드로 오디오 컨텍스트 생성
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive'
    });

    // 2. 브라우저 내부 잡음제거/에코제거를 꺼서 레이턴시 최소화
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    micSourceNode = audioCtx.createMediaStreamSource(micStream);

    // 3. 리버브 노드 세팅
    delayNode = audioCtx.createDelay();
    delayNode.delayTime.value = 0.12;

    feedbackGain = audioCtx.createGain();
    feedbackGain.gain.value = 0.35;

    dryGainNode = audioCtx.createGain();
    wetGainNode = audioCtx.createGain();

    // 4. 피드백 루프 연결
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);

    // 마이크 ➔ 리버브 ➔ Wet 출력
    micSourceNode.connect(delayNode);
    delayNode.connect(wetGainNode);

    // 마이크 ➔ Dry 출력
    micSourceNode.connect(dryGainNode);

    // 슬라이더 설정값 적용
    updateReverb(document.getElementById('reverbRange').value);
  }
}

// 리버브 수치 변경
function updateReverb(val) {
  document.getElementById('reverbValText').innerText = val + '%';
  if (wetGainNode) {
    wetGainNode.gain.value = (val / 100) * 0.8;
  }
}

// 귀 모니터링 토글 스위치
async function toggleMonitoring() {
  const isChecked = document.getElementById('monitorToggle').checked;
  try {
    await initAudioEngine();
    if (isChecked) {
      dryGainNode.connect(audioCtx.destination);
      wetGainNode.connect(audioCtx.destination);
    } else {
      dryGainNode.disconnect(audioCtx.destination);
      wetGainNode.disconnect(audioCtx.destination);
    }
  } catch (err) {
    alert("마이크 연결에 실패했습니다. 권한을 확인해 보세요.");
    document.getElementById('monitorToggle').checked = false;
  }
}

// 녹음 및 반주 시작
async function startRecording() {
  const status = document.getElementById('recStatus');
  const mrPlayer = document.getElementById('mrPlayer');

  try {
    await initAudioEngine();
    
    if (document.getElementById('monitorToggle').checked) {
      dryGainNode.connect(audioCtx.destination);
      wetGainNode.connect(audioCtx.destination);
    }

    mediaRecorder = new MediaRecorder(micStream);
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
    
    if (mrPlayer.src) {
      mrPlayer.currentTime = 0;
      mrPlayer.play();
    }

    document.getElementById('btnRecStart').style.display = "none";
    document.getElementById('btnRecStop').style.display = "inline-block";
    status.style.color = "#ef4444";
    status.innerText = "🔴 반주 재생 및 실시간 녹음 중입니다...";

  } catch (err) {
    alert("마이크 사용 권한을 허용해 보세요.");
  }
}

// 녹음 및 반주 중지
function stopRecording() {
  const mrPlayer = document.getElementById('mrPlayer');
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (mrPlayer.src) {
    mrPlayer.pause();
  }

  document.getElementById('btnRecStart').style.display = "inline-block";
  document.getElementById('btnRecStop').style.display = "none";
  
  const status = document.getElementById('recStatus');
  status.style.color = "#10b981";
  status.innerText = "🟢 녹음이 완료되었습니다. 아래에서 확인해 보세요!";
}
