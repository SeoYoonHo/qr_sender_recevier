const video = document.getElementById("video");
const status = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");
const missingIndicesDisplay = document.getElementById("missingIndicesDisplay");
const gridContainer = document.getElementById("gridContainer");

let receivedChunks = new Map();
let totalEncodedChunks = 0;
let fileName = "";
let requiredChunks = 0;
const cached = new Set();

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

function adjustCanvasSize() {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  canvas.width = videoWidth;
  canvas.height = videoHeight;
}

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

  // 미수신 인덱스 실시간 표시
  updateMissingIndicesDisplay();

  if (receivedCount >= requiredChunks && downloadBtn.style.display === "none") {
    assembleFile();
  }
}

function updateMissingIndicesDisplay() {
  const missingIndices = [];
  for (let i = 0; i < totalEncodedChunks; i++) {
    if (!receivedChunks.has(i)) {
      missingIndices.push(i);
    }
  }
  missingIndicesDisplay.textContent = `미수신 인덱스: ${missingIndices.join(
    ", "
  )}`;
}

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
