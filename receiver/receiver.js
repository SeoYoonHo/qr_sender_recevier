const video = document.getElementById("video");
const status = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");
const missingIndicesDisplay = document.getElementById("missingIndicesDisplay");
const gridContainer = document.getElementById("gridContainer");

let receivedChunks = new Map();
let totalEncodedChunks = 0;
let fileExtension = ""; // 확장자만 저장
let requiredChunks = 0;
const cached = new Set();

const canvas = document.createElement("canvas");
const context = canvas.getContext("2d", { willReadFrequently: true });

// 카메라 초기화 및 QR 코드 스캔 시작
navigator.mediaDevices
  .getUserMedia({ video: { facingMode: "environment" } })
  .then((stream) => {
    video.srcObject = stream;
    video.setAttribute("playsinline", true); // iOS에서 전체 화면을 방지하기 위해 필요
    video.addEventListener("loadedmetadata", () => {
      video.play();
      adjustCanvasSize();
      requestAnimationFrame(scanQRCode);
    });
  })
  .catch((err) => console.error("Error accessing camera: ", err));

// 캔버스 크기 조정
function adjustCanvasSize() {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  canvas.width = videoWidth;
  canvas.height = videoHeight;
}

// QR 코드를 스캔하고 데이터를 처리
function scanQRCode() {
  adjustCanvasSize();
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, canvas.width, canvas.height);

  if (code && code.data && !cached.has(code.data)) {
    cached.add(code.data);
    processQRCodeData(code.data); // QR 데이터 처리
  }

  requestAnimationFrame(scanQRCode);
}

// QR 데이터를 처리
function processQRCodeData(strData) {
  try {
    const parsedData = JSON.parse(strData);
    const { ext, total, i: index, c: chunk } = parsedData;

    // 첫 번째 QR 코드에서 확장자와 총 조각 수 설정
    if (ext && total && !fileExtension) {
      fileExtension = ext;
      totalEncodedChunks = total;
      requiredChunks = Math.ceil(totalEncodedChunks * 0.8);
      initializeGrid(totalEncodedChunks);
    }

    // 중복되지 않은 조각만 저장
    if (!receivedChunks.has(index)) {
      receivedChunks.set(
        index,
        new Uint8Array(
          atob(chunk)
            .split("")
            .map((char) => char.charCodeAt(0))
        )
      );

      // 그리드 요소가 존재할 때만 클래스 추가
      const gridItem = document.getElementById(`chunk-${index}`);
      if (gridItem) {
        gridItem.classList.add("received");
      }
    }

    const receivedCount = receivedChunks.size;
    const percent = Math.floor((receivedCount / totalEncodedChunks) * 100);
    status.textContent = `수신 중: ${receivedCount}/${totalEncodedChunks} (${percent}%)`;

    // 미수신 인덱스 실시간 표시
    updateMissingIndicesDisplay();

    if (
      receivedCount >= requiredChunks &&
      downloadBtn.style.display === "none"
    ) {
      assembleFile();
    }
  } catch (error) {
    console.error("QR 데이터 파싱 오류:", error);
  }
}

// 미수신 인덱스 업데이트
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

// 그리드 초기화
function initializeGrid(totalChunks) {
  gridContainer.innerHTML = "";
  totalEncodedChunks = totalChunks;
  for (let i = 0; i < totalEncodedChunks; i++) {
    const square = document.createElement("div");
    square.classList.add("grid-item");
    square.id = `chunk-${i}`;
    gridContainer.appendChild(square);
  }
}

// 파일 조립 및 다운로드 링크 생성
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
    a.download = `received_file.${fileExtension}`; // 확장자를 이용한 파일명 지정
    a.click();
    URL.revokeObjectURL(url);
  };

  status.textContent = "파일 수신 완료!";
}
