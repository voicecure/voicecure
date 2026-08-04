// 싱크 오차 보정(Offset Compensation)이 적용된 녹음 시작 함수
async function startRecording() {
  const status = document.getElementById('recStatus');
  const audioPlayer = document.getElementById('internalAudioPlayer');
  const iframe = document.getElementById('ytIframe');

  if (!isAudioLoaded) {
    alert("먼저 유튜브 주소를 입력하고 [반주 불러오기]를 진행해 보세요.");
    return;
  }

  try {
    await initAudioEngine();

    // 반주 소리를 귀(이어폰)로 전달
    mrSourceNode.connect(audioCtx.destination);

    // 믹싱 트랙 생성
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

    // 1. 마이크 녹음기 먼저 시동 (마이크 예열 시작)
    mediaRecorder.start();

    // 2. 마이크 버퍼 예열 시간(0.12초)만큼 정밀하게 기다린 후 반주 재생 시작
    setTimeout(() => {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      audioPlayer.currentTime = 0;
      audioPlayer.play();
    }, 120); // 120ms(0.12초) 싱크 보정값 적용

    document.getElementById('btnRecStart').style.display = "none";
    document.getElementById('btnRecStop').style.display = "inline-block";
    status.style.color = "#ef4444";
    status.innerText = "🔴 싱크 보정 녹음 중입니다. (유선 이어폰 착용 권장)";

  } catch (err) {
    alert("오디오 가동 실패: " + err.message);
  }
}
