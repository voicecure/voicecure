// 극단적 저지연 마이크 이니셜라이징
async function initAudioEngine() {
  if (!audioCtx) {
    // 1. 버퍼 크기 최단 설정 (interactive)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive'
    });

    // 2. 지연을 일으키는 브라우저 내부 필터(에코 제거, 소음 억제) 전부 비활성화
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
