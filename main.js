// DEBUGONLY: 순수 마이크 입력 테스트 엔진 (main.js)
async function initAudioEngine() {
  if (!audioCtx) {
    console.log("디버그: 오디오 엔진 초기화 중...");
    // 표준 모드로 오디오 컨텍스트 생성
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // 순수 마이크 요청 (모든 최적화 옵션 끄기)
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("디버그: 마이크 스트림 획득 성공.");
    } catch (err) {
      console.error("디버그 에러: 마이크 권한 실패.", err);
      alert("DEBUG: 마이크 연결 실패 - " + err.name);
      return;
    }

    micSourceNode = audioCtx.createMediaStreamSource(micStream);
    dryGainNode = audioCtx.createGain();

    // 볼륨 조절 없이 다이렉트 연결
    micSourceNode.connect(dryGainNode);
  }

  // 브라우저 오디오 잠금 해제
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
    console.log("디버그: 오디오 잠금 해제됨.");
  }
}

// 귀 모니터링 토글 (다이렉트 연결)
async function toggleMonitoring() {
  const isChecked = document.getElementById('monitorToggle').checked;
  console.log("디버그: 모니터링 토글 ->", isChecked);
  try {
    await initAudioEngine();
    if (!micStream) return; // 마이크 초기화 실패 시 중단

    if (isChecked) {
      console.log("디버그: 마이크 ➔ 이어폰 직통 연결");
      dryGainNode.connect(audioCtx.destination);
    } else {
      console.log("디버그: 마이크 연결 해제");
      dryGainNode.disconnect(audioCtx.destination);
    }
  } catch (err) {
    console.error("디버그 에러: toggleMonitoring 실패.", err);
    alert("DEBUG: 연결 실패 - " + err.message);
    document.getElementById('monitorToggle').checked = false;
  }
}
// ... main.js의 나머지 녹음 관련 코드 ...
