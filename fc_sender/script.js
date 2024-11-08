const fileInput = document.getElementById("fileInput");
const qrCanvas = document.getElementById("qrCanvas");
const status = document.getElementById("status");
const frameSlider = document.getElementById("frameSlider");
const frameLabel = document.getElementById("frameLabel");

let fileChunks = [];
let encodedChunks = [];
let totalChunks = 0;
let fps = 1;
let intervalId = null;
let fileName = ""; // 파일 이름 저장
let sentCount = 0; // 송신된 QR 코드 개수

frameSlider.addEventListener("input", () => {
  frameLabel.textContent = frameSlider.value;
});

frameSlider.addEventListener("change", () => {
  fps = frameSlider.value;
  resetSendingInterval();
});

function resetSendingInterval() {
  clearInterval(intervalId);
  if (totalChunks > 0) {
    intervalId = setInterval(sendNextChunk, 1000 / fps);
  }
}

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

      // Fountain Code 방식으로 인코딩된 조각 생성 (2배 개수)
      encodedChunks = generateLTChunks(fileChunks);
      status.textContent = `파일 준비 완료. 총 조각 수: ${encodedChunks.length}`;
      resetSendingInterval();
    };
    reader.readAsArrayBuffer(file);
  }
});

function generateLTChunks(chunks) {
  const encodedChunks = [];
  for (let i = 0; i < chunks.length * 2; i++) {
    const selectedChunks = selectRandomChunks(chunks);
    const encodedChunk = xorChunks(selectedChunks);
    encodedChunks.push({
      data: Array.from(encodedChunk),
      index: i, // 인덱스 추가
      totalEncoded: chunks.length * 2, // 총 QR 개수 (2배)
      fileName: fileName, // 파일 이름 추가
    });
  }
  return encodedChunks;
}

function selectRandomChunks(chunks) {
  const count = Math.floor(Math.random() * chunks.length) + 1;
  const selectedChunks = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * chunks.length);
    selectedChunks.push(chunks[index]);
  }
  return selectedChunks;
}

function xorChunks(selectedChunks) {
  return selectedChunks.reduce(
    (acc, chunk) => acc.map((byte, i) => byte ^ chunk[i]),
    new Uint8Array(selectedChunks[0].length)
  );
}

function sendNextChunk() {
  const index = sentCount % encodedChunks.length; // 인덱스 순서로 조각 선택
  const chunkData = encodedChunks[index];

  QRCode.toCanvas(
    qrCanvas,
    JSON.stringify(chunkData),
    { width: qrCanvas.width, height: qrCanvas.height },
    (error) => {
      if (error) console.error(error);
      sentCount++;
      status.textContent = `송신 중: ${index + 1}/${
        encodedChunks.length
      } 조각 (총 송신: ${sentCount})`;
    }
  );
}
