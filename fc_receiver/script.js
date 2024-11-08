// `jsQR` 라이브러리를 불러오기 위해 HTML에 `<script src="path/to/jsQR.js"></script>` 포함 필요
const video = document.getElementById("video");
const status = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");
const gridContainer = document.getElementById("gridContainer");

let receivedChunks = new Map();
let totalEncodedChunks = 0;
let fileName = "";
let requiredChunks = 0;
const cached = new Set();

// 비디오 스트림과 캔버스 초기화
const canvas = document.createElement("canvas");
const context = canvas.getContext("2d", { willReadFrequently: true });

navigator.mediaDevices
  .getUserMedia({ video: { facingMode: "environment" } })
  .then((stream) => {
    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    video.addEventListener("canplay", () => {
      video.play();
      adjustCanvasSize();
      requestAnimationFrame(scanQRCode);
    });
  })
  .catch((err) => console.error("Error accessing camera: ", err));

// 캔버스 크기 조절 함수
function adjustCanvasSize() {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  canvas.width = videoWidth;
  canvas.height = videoHeight;
}

// QR 코드 스캔 함수
function scanQRCode() {
  adjustCanvasSize();
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, canvas.width, canvas.height);

  if (code && code.data) {
    processQRCodeData(code.data);
  }

  requestAnimationFrame(scanQRCode);
}

// QR 코드 데이터 처리 함수
function processQRCodeData(strData) {
  if (!strData || cached.has(strData)) return;

  cached.add(strData);
  const data = parseQRData(strData);
  if (!data) {
    console.error("QR 데이터 파싱 실패");
    return;
  }

  if (!fileName) {
    fileName = data.fileName;
    initializeGrid(data.totalEncoded);
  }

  if (!receivedChunks.has(data.index)) {
    receivedChunks.set(data.index, new Uint8Array(data.chunk));
    document.getElementById(`chunk-${data.index}`).classList.add("received");
  }

  const receivedCount = receivedChunks.size;
  const percent = Math.floor((receivedCount / totalEncodedChunks) * 100);
  status.textContent = `수신 중: ${receivedCount}/${totalEncodedChunks} (${percent}%)`;

  if (receivedCount >= requiredChunks && downloadBtn.style.display === "none") {
    assembleFile();
  }
}

// QR 코드 데이터 파싱 함수 (기본적인 JSON 형식으로 가정)
function parseQRData(strData) {
  try {
    const parsedData = JSON.parse(strData);
    const { fileName, totalEncoded, index, chunk } = parsedData;
    return { fileName, totalEncoded, index, chunk: new Uint8Array(chunk) };
  } catch (e) {
    console.error("데이터 파싱 오류:", e);
    return null;
  }
}

// 수신 상태 표시용 그리드 초기화
function initializeGrid(totalChunks) {
  gridContainer.innerHTML = "";
  totalEncodedChunks = totalChunks;
  requiredChunks = Math.ceil(totalEncodedChunks * 0.8);
  for (let i = 0; i < totalEncodedChunks; i++) {
    const square = document.createElement("div");
    square.classList.add("grid-item");
    square.id = `chunk-${i}`;
    gridContainer.appendChild(square);
  }
}

// 파일 조립 및 다운로드 준비
function assembleFile() {
  const fileData = [];
  receivedChunks.forEach((chunk) => fileData.push(...chunk));

  const blob = new Blob([new Uint8Array(fileData)], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);

  downloadBtn.style.display = "block";
  downloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  status.textContent = "파일 수신 완료!";
}
