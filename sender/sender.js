const fileInput = document.getElementById("fileInput");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const frameRateSlider = document.getElementById("frameRateSlider");
const frameRateLabel = document.getElementById("frameRateLabel");
const resendIndicesInput = document.getElementById("resendIndicesInput");
const resendButton = document.getElementById("resendButton");
const qrCanvasContainer = document.getElementById("qrCanvasContainer");
const status = document.getElementById("status");

let fileChunks = [];
let totalChunks = 0;
let fileName = "";
let frameInterval = 50; // 기본 송출 간격 (20 FPS로 시작)
let indicesToSend = [];
let currentIdx = 0;
let isPaused = false;

// 파일을 QR 코드로 분할
fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    fileName = file.name;
    const chunkSize = 100;
    const reader = new FileReader();
    reader.onload = function (e) {
      const fileData = new Uint8Array(e.target.result);
      fileChunks = [];

      for (let i = 0; i < fileData.length; i += chunkSize) {
        fileChunks.push(fileData.slice(i, i + chunkSize));
      }
      totalChunks = fileChunks.length;
      status.textContent = `파일 준비 완료. 총 조각 수: ${totalChunks}`;
    };
    reader.readAsArrayBuffer(file);
  }
});

// 송출 프레임 설정 (마우스를 떼면 적용)
frameRateSlider.max = 20; // 슬라이더 최대값을 20 FPS로 제한
frameRateSlider.value = 20; // 초기값 20 FPS로 설정
frameRateLabel.textContent = "20 FPS"; // 화면에 기본값 표시

frameRateSlider.addEventListener("input", () => {
  const frameRate = parseInt(frameRateSlider.value);
  frameRateLabel.textContent = `${frameRate} FPS`;
});

frameRateSlider.addEventListener("change", () => {
  const frameRate = parseInt(frameRateSlider.value);
  frameInterval = 1000 / frameRate; // ms로 변환
});

// QR 코드 송신 함수
function sendChunk(index) {
  const chunkData = {
    fileName: fileName,
    totalEncoded: totalChunks,
    index: index,
    chunk: Array.from(fileChunks[index]),
  };
  qrCanvasContainer.innerHTML = ""; // 기존 QR 코드 삭제
  const qrCanvas = document.createElement("div");
  new QRCode(qrCanvas, {
    text: JSON.stringify(chunkData),
    width: 1000,
    height: 1000,
  });
  qrCanvasContainer.appendChild(qrCanvas);

  status.textContent = `송신 중: 인덱스 ${index} / ${totalChunks}`;
}

// 전체 전송 시작
startButton.addEventListener("click", () => {
  indicesToSend = Array.from(Array(totalChunks).keys()); // 모든 인덱스
  currentIdx = 0;
  isPaused = false;
  sendLoop();
});

// `setTimeout`을 사용한 송신 루프
function sendLoop() {
  if (isPaused || currentIdx >= indicesToSend.length) return;

  sendChunk(indicesToSend[currentIdx]);
  currentIdx++;

  setTimeout(sendLoop, frameInterval); // 재귀 호출로 간격 제어
}

// 중지 버튼
pauseButton.addEventListener("click", () => {
  isPaused = true;
  status.textContent = "전송 일시 중지";
});

// 특정 인덱스 송신
resendButton.addEventListener("click", () => {
  const indices = resendIndicesInput.value
    .split(",")
    .map((num) => parseInt(num.trim()))
    .filter((num) => !isNaN(num));
  if (indices.length > 0) {
    indicesToSend = indices;
    currentIdx = 0;
    isPaused = false;
    sendLoop();
  } else {
    alert("유효한 인덱스를 입력하세요.");
  }
});
