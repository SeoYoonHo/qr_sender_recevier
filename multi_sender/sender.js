const fileInput = document.getElementById("fileInput");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const frameRateSlider = document.getElementById("frameRateSlider");
const frameRateLabel = document.getElementById("frameRateLabel");
const resendIndicesInput = document.getElementById("resendIndicesInput");
const resendButton = document.getElementById("resendButton");
const qrCanvasContainer1 = document.getElementById("qrCanvasContainer1");
const qrCanvasContainer2 = document.getElementById("qrCanvasContainer2");
const status = document.getElementById("status");

const downloadBtn = document.getElementById("downloadBtn");

let fileChunks = [];
let totalChunks = 0;
let fileExtension = "";
let frameInterval = 50;
let indicesToSend = [];
let currentIdx = 0;
let isPaused = false;
const chunkSize = 100;

// 파일을 Base64로 인코딩하고 청크로 분할
fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    fileExtension = file.name.split(".").pop();
    const reader = new FileReader();
    reader.onload = function (e) {
      let base64Data = btoa(
        String.fromCharCode.apply(null, new Uint8Array(e.target.result))
      );
      fileChunks = [];
      for (let i = 0; i < base64Data.length; i += chunkSize) {
        const chunk = base64Data.slice(i, i + chunkSize);
        fileChunks.push(chunk);
      }
      totalChunks = fileChunks.length;
      status.textContent = `파일 준비 완료. 총 청크 수: ${totalChunks}`;

      // 테스트용도
      const testBase64Data = fileChunks.join("");
      const binaryString = atob(testBase64Data);
      const len = binaryString.length;
      const uint8Array = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([uint8Array], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      downloadBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `sender_file.${fileExtension}`;
        a.click();
        URL.revokeObjectURL(url);
      };
    };
    reader.readAsArrayBuffer(file);
  }
});

// 송출 프레임 설정
frameRateSlider.max = 60;
frameRateSlider.value = 20;
frameRateLabel.textContent = "20 FPS";

frameRateSlider.addEventListener("input", () => {
  const frameRate = parseInt(frameRateSlider.value);
  frameRateLabel.textContent = `${frameRate} FPS`;
});

frameRateSlider.addEventListener("change", () => {
  const frameRate = parseInt(frameRateSlider.value);
  frameInterval = 1000 / frameRate;
});

// QR 코드 송신 함수
function sendChunk(index) {
  if (index >= totalChunks) return;

  const chunkData = {
    ext: fileExtension,
    total: totalChunks,
    i: index,
    c: fileChunks[index],
  };

  const qrCanvas = document.createElement("div");
  new QRCode(qrCanvas, {
    text: JSON.stringify(chunkData),
    width: 500,
    height: 500,
  });
  const container = index % 2 === 0 ? qrCanvasContainer1 : qrCanvasContainer2;
  container.innerHTML = ""; // 이전 QR 코드 지우기
  container.appendChild(qrCanvas);

  status.textContent = `송신 중: 인덱스 ${index + 1} / ${totalChunks}`;
}

// 전체 전송 시작
startButton.addEventListener("click", () => {
  indicesToSend = Array.from(Array(totalChunks).keys());
  currentIdx = 0;
  isPaused = false;
  sendLoop();
});

function sendLoop() {
  if (isPaused || currentIdx >= indicesToSend.length) return;

  sendChunk(indicesToSend[currentIdx]);
  currentIdx += 1; // 한 번에 하나의 QR 코드 송신

  setTimeout(sendLoop, frameInterval);
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
