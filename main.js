// 초경량 밸런스 오디오 엔진 (볼륨 증폭 + 초경량 리버브)
async function initAudioEngine() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 0
    });

    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true, // 마이크 기본 수신 볼륨을 켜둡니다.
        latency: 0
      }
    });

    micSourceNode = audioCtx.createMediaStreamSource(micStream);

    // 1. 목소리 볼륨 앰프 (소리를 2.5배로 크게 뻥튀기)
    dryGainNode = audioCtx.createGain();
    dryGainNode.gain.value = 2.5; 

    // 2. 초경량 1단 리버브 파이프 (지연 부담 최소화)
    delayNode = audioCtx.createDelay();
    delayNode.delayTime.value = 0.08; // 0.08초의 아주 찰나의 공간감만 부여

    wetGainNode = audioCtx.createGain();
    
    // 신호 선로 연결
    micSourceNode.connect(dryGainNode); // 생목소리 앰프 연결
    micSourceNode.connect(delayNode);   // 초경량 리버브 연결
    delayNode.connect(wetGainNode);

    updateReverb(document.getElementById('reverbRange').value);
  }

  // 모바일 브라우저 오디오 잠금 강제 해제
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

// 리버브 수치 변경
function updateReverb(val) {
  document.getElementById('reverbValText').innerText = val + '%';
  if (wetGainNode) {
    wetGainNode.gain.value = (val / 100) * 0.5; // 은은하고 부드러운 리버브
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
