// 극단적 저지연(Ultra-low latency) 오디오 엔진
async function initAudioEngine() {
  if (!audioCtx) {
    // 1. 버퍼 크기를 0으로 강제하여 지연 시간 최소화
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 0
    });

    // 2. 마이크 하드웨어에 최단 거리 신호 요청
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0
      }
    });

    micSourceNode = audioCtx.createMediaStreamSource(micStream);
    dryGainNode = audioCtx.createGain();

    // 3. 연산 지연을 일으키는 리버브 노드를 건너뛰고 스피커로 직통 연결
    micSourceNode.connect(dryGainNode);
  }
}

// 귀 모니터링 토글 (직통 연결)
async function toggleMonitoring() {
  const isChecked = document.getElementById('monitorToggle').checked;
  try {
    await initAudioEngine();
    if (isChecked) {
      dryGainNode.connect(audioCtx.destination);
    } else {
      dryGainNode.disconnect(audioCtx.destination);
    }
  } catch (err) {
    alert("마이크 연결에 실패했습니다. 권한을 확인해 보세요.");
    document.getElementById('monitorToggle').checked = false;
  }
}
