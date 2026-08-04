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

// --- 3. 오디오 엔진 (강제 수도꼭지 해제 + 볼륨 3배 앰프) ---
let audioCtx = null;
let micStream = null;
let micSourceNode = null;
let dryGainNode = null;
let mediaRecorder = null;
let recordedChunks = [];

function loadMrFile(input) {
  const file = input.files[0];
  if (file) {
    const mrPlayer = document.getElementById('mrPlayer');
    mrPlayer.src = URL.createObjectURL(file);
    mrPlayer.style.display = "block";
  }
}

// 마이크 엔진 접속 및 수도꼭지 강제 개방
async function initAudioEngine() {
  if (!audioCtx) {
    // 1. 순수 표준 오디오 엔진 생성
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 2. 가장 안정적인 기본 마이크 권한 수신
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micSourceNode = audioCtx.createMediaStreamSource(micStream);

    // 3. 목소리 크기를 3배로 키우는 강력 앰프 설치
    dryGainNode = audioCtx.createGain();
    dryGainNode.gain.value = 3.0; 

    micSourceNode.connect(dryGainNode);
  }

  // 4. 모바일 브라우저의 잠긴 수도꼭지를 손가락 터치 시점에 강제로 엽니다.
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

function updateReverb(val) {
  document.getElementById('reverbValText').innerText = val + '%';
}

// 귀 모니터링 토글
async function toggleMonitoring() {
  const isChecked = document.getElementById('monitorToggle').checked;
  const status = document.getElementById('recStatus');

  try {
    // 터치하는 순간 오디오 엔진 작동 및 잠금 해제
    await initAudioEngine();

    if (isChecked) {
      // 마이크 ➔ 3배 앰프 ➔ 이어폰 출력 연결
      dryGainNode.connect(audioCtx.destination);
      status.style.color = "#10b981";
      status.innerText = "🔊 모니터링 켜짐! (오디오 상태: " + audioCtx.state + ")";
    } else {
      dryGainNode.disconnect(audioCtx.destination);
      status.style.color = "#64748b";
      status.innerText = "🔇 모니터링 꺼짐";
    }
  } catch (err) {
    alert("마이크 연결 실패: " + err.message);
    document.getElementById('monitorToggle').checked = false;
  }
}

// 녹음 시작
async function startRecording() {
  const status = document.getElementById('recStatus');
  const mrPlayer = document.getElementById('mrPlayer');

  try {
    await initAudioEngine();
    
    if (document.getElementById('monitorToggle').checked) {
      dryGainNode.connect(audioCtx.destination);
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
    status.innerText = "🔴 녹음 진행 중입니다...";

  } catch (err) {
    alert("마이크 권한을 허용해 보세요.");
  }
}

// 녹음 정지
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
  status.innerText = "🟢 녹음 완료! 아래에서 들어보세요.";
}
