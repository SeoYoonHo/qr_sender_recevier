const video1 = document.getElementById("video1");
const video2 = document.getElementById("video2");
const status = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");
const missingIndicesDisplay = document.getElementById("missingIndicesDisplay");
const gridContainer = document.getElementById("gridContainer");

let receivedChunks = new Map();
let totalEncodedChunks = 0;
let fileExtension = "";
let requiredChunks = 0;
const cached = new Set();

const canvas1 = document.createElement("canvas");
const context1 = canvas1.getContext("2d", { willReadFrequently: true });
const canvas2 = document.createElement("canvas");
const context2 = canvas2.getContext("2d", { willReadFrequently: true });

window.onload = async function () {
  await listDevices();
};

async function listDevices() {
  try {
    await askForPermissions();
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );

    const camSelect1 = document.getElementById("select-camera-1");
    const camSelect2 = document.getElementById("select-camera-2");
    camSelect1.innerHTML = "";
    camSelect2.innerHTML = "";

    videoDevices.forEach((device, index) => {
      const option1 = new Option(
        device.label || `Camera ${index + 1}`,
        device.deviceId
      );
      const option2 = new Option(
        device.label || `Camera ${index + 1}`,
        device.deviceId
      );
      camSelect1.appendChild(option1);
      camSelect2.appendChild(option2);
    });

    camSelect1.selectedIndex = 0;
    camSelect2.selectedIndex = videoDevices.length > 1 ? 1 : 0;

    document
      .getElementById("btn-open-camera")
      .addEventListener("click", openCameras);
  } catch (error) {
    console.error("Error listing devices:", error);
  }
}

async function askForPermissions() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    closeStream(stream);
  } catch (error) {
    console.error("Camera permission error:", error);
    alert("카메라 권한을 허용해 주세요.");
  }
}

function closeStream(stream) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

async function openCameras() {
  const camSelect1 = document.getElementById("select-camera-1");
  const camSelect2 = document.getElementById("select-camera-2");

  const camera1Id = camSelect1.value;
  const camera2Id = camSelect2.value;

  if (camera1Id) {
    await startCamera(video1, camera1Id, context1, processQRCodeData);
  } else {
    console.warn("Camera 1 ID not found. Default camera will be used.");
    await startCamera(video1, null, context1, processQRCodeData);
  }

  if (camera2Id) {
    await startCamera(video2, camera2Id, context2, processQRCodeData);
  } else {
    console.warn("Camera 2 ID not found. Default camera will be used.");
    await startCamera(video2, null, context2, processQRCodeData);
  }
}

async function startCamera(
  videoElement,
  deviceId,
  context,
  processDataCallback
) {
  const constraints = deviceId
    ? { video: { deviceId: { exact: deviceId } }, audio: false }
    : { video: true, audio: false };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    requestAnimationFrame(() =>
      scanQRCode(videoElement, context, processDataCallback)
    );
  } catch (error) {
    console.error("Error starting camera:", error);
  }
}

function scanQRCode(video, context, processDataCallback) {
  context.drawImage(video, 0, 0, canvas1.width, canvas1.height);
  const imageData = context.getImageData(0, 0, canvas1.width, canvas1.height);
  const code = jsQR(imageData.data, canvas1.width, canvas1.height);

  if (code && code.data) {
    processDataCallback(code.data);
  }
  requestAnimationFrame(() => scanQRCode(video, context, processDataCallback));
}

function processQRCodeData(strData) {
  try {
    const parsedData = JSON.parse(strData);
    const { ext, total, i: index, c: chunk } = parsedData;

    if (ext && total && !fileExtension) {
      fileExtension = ext;
      totalEncodedChunks = total;
      initializeGrid(totalEncodedChunks);
    }

    if (!receivedChunks.has(index)) {
      receivedChunks.set(index, chunk);

      const gridItem = document.getElementById(`chunk-${index}`);
      if (gridItem) {
        gridItem.classList.add("received");
      }
    }

    const receivedCount = receivedChunks.size;
    const percent =
      totalEncodedChunks > 0
        ? Math.floor((receivedCount / totalEncodedChunks) * 100)
        : 0;
    status.textContent = `수신 중: ${receivedCount}/${totalEncodedChunks} (${percent}%)`;

    updateMissingIndicesDisplay();

    // 모든 청크가 수신되었을 때만 파일을 합칩니다.
    if (
      receivedCount === totalEncodedChunks &&
      downloadBtn.style.display === "none"
    ) {
      assembleFile();
    }
  } catch (error) {
    console.error("QR 데이터 파싱 오류:", error);
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

function assembleFile() {
  if (receivedChunks.size !== totalEncodedChunks) {
    console.warn(
      `전체 청크 수: ${totalEncodedChunks}, 수신된 청크 수: ${receivedChunks.size}`
    );
    console.warn("누락된 청크가 있어 파일이 완전하지 않을 수 있습니다.");
  }

  const fileData = [];

  // 청크를 인덱스 순서대로 병합
  for (let i = 0; i < totalEncodedChunks; i++) {
    const chunk = receivedChunks.get(i);
    if (chunk) {
      fileData.push(chunk);
    } else {
      console.warn(`누락된 청크 인덱스: ${i}`);
    }
  }

  const base64Data = fileData.join("");
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const uint8Array = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([uint8Array], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  downloadBtn.style.display = "block";
  downloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `received_file.${fileExtension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  status.textContent = "파일 수신 완료!";
}
