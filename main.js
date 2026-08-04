// main.js - loadYoutubeKaraoke 함수 내부 에러 처리 강화
async function loadYoutubeKaraoke() {
  const urlInput = document.getElementById('ytUrlInput');
  const status = document.getElementById('recStatus');
  
  if (!urlInput || !status) return;

  const url = urlInput.value.trim();
  const videoId = extractVideoId(url);

  if (!url || !videoId) {
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 올바른 유튜브 주소를 입력 칸에 붙여넣어 보세요.";
    return;
  }

  // 초기화
  isAudioLoaded = false;
  status.style.color = "#3b52d4";
  status.innerText = "🎬 화면을 연결하고 반주 음원을 추출하는 중입니다...";

  const iframe = document.getElementById('ytIframe');
  iframe.src = "https://www.youtube.com/embed/" + videoId + "?enablejsapi=1&mute=1";
  document.getElementById('videoContainer').style.display = "block";
  document.getElementById('ytFallbackBtn').style.display = "block";

  // 음원 추출 통신
  try {
    const res = await fetch('https://pipedapi.kavin.rocks/streams/' + videoId);
    const data = await res.json();
    
    if (data && data.audioStreams && data.audioStreams.length > 0) {
      const audioPlayer = document.getElementById('internalAudioPlayer');
      audioPlayer.src = data.audioStreams[0].url;
      isAudioLoaded = true; // 음원 확보 성공

      status.style.color = "#10b981";
      status.innerText = "🟢 반주 준비 완료! [반주 재생 & 녹음 시작]을 눌러보세요.";
      return;
    }
  } catch (err) {
    console.error("1차 통신 실패:", err);
  }

  // 1차 실패 시 백업 서버 시도
  try {
    const res2 = await fetch('https://api.piped.privacydev.net/streams/' + videoId);
    const data2 = await res2.json();
    if (data2 && data2.audioStreams && data2.audioStreams.length > 0) {
      const audioPlayer = document.getElementById('internalAudioPlayer');
      audioPlayer.src = data2.audioStreams[0].url;
      isAudioLoaded = true; // 음원 확보 성공

      status.style.color = "#10b981";
      status.innerText = "🟢 백업 연결 완료! [반주 재생 & 녹음 시작]을 눌러보세요.";
      return;
    }
  } catch (e2) {
    console.error("2차 통신 실패:", e2);
  }

  // 음원 추출 실패 시 명확한 원인 안내
  isAudioLoaded = false;
  status.style.color = "#ef4444";
  status.innerText = "⚠️ 브라우저의 광고 차단기(애드블록)로 인해 음원 추출이 차단되었습니다. 차단기를 끄거나 시크릿 모드를 이용해 보세요.";
}

// main.js - startRecording 함수 시작 부분 안내 수정
async function startRecording() {
  const status = document.getElementById('recStatus');

  if (!isAudioLoaded) {
    status.style.color = "#ef4444";
    status.innerText = "⚠️ 반주 음원이 준비되지 않았습니다. [반주 불러오기]를 다시 누르거나 애드블록을 꺼주세요.";
    return;
  }
  
  // 이하 동일...
}
