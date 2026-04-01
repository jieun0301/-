import { useEffect, useRef, useState } from "react";

const OWNER = "USERNAME";
const REPO = "REPO";
const BRANCH = "main";
const JSON_PATH = "videos.json";

const RAW_JSON_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${JSON_PATH}`;

export default function App() {
  const [videos, setVideos] = useState([]);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState("viewer");

  const touchStartY = useRef(0);
  const wheelLock = useRef(false);

  useEffect(() => {
    fetch(RAW_JSON_URL, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setVideos(Array.isArray(data) ? data : []))
      .catch(() => setVideos([]));
  }, []);

  const next = () => setCurrent((c) => (c < videos.length - 1 ? c + 1 : c));
  const prev = () => setCurrent((c) => (c > 0 ? c - 1 : c));

  const handleWheel = (e) => {
    if (wheelLock.current) return;
    wheelLock.current = true;
    setTimeout(() => (wheelLock.current = false), 400);
    e.deltaY > 0 ? next() : prev();
  };

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (diff > 60) next();
    else if (diff < -60) prev();
  };

  // 🔥 안정화된 업로드
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const uploadToGitHub = async (file) => {
    try {
      const token = prompt("GitHub Token 입력");
      if (!token) return;

      if (file.size > 90 * 1024 * 1024) {
        alert("파일 너무 큼 (100MB 제한)");
        return;
      }

      const base64 = await fileToBase64(file);
      const filePath = `videos/${Date.now()}_${file.name}`;

      // 1. 영상 업로드
      const uploadRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({
            message: "upload video",
            content: base64,
            branch: BRANCH,
          }),
        }
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        alert("영상 업로드 실패: " + err.message);
        return;
      }

      const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${filePath}`;

      // 2. JSON 가져오기 (없으면 새로 생성)
      let jsonData, decoded, sha;

      const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${JSON_PATH}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 404) {
        decoded = [];
      } else {
        jsonData = await res.json();
        sha = jsonData.sha;
        decoded = JSON.parse(atob(jsonData.content));
      }

      const newVideo = {
        id: Date.now(),
        url: rawUrl,
        title: file.name,
      };

      const updated = [newVideo, ...decoded];

      // 3. JSON 업로드
      const jsonRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${JSON_PATH}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({
            message: "update videos.json",
            content: btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2)))),
            sha,
            branch: BRANCH,
          }),
        }
      );

      if (!jsonRes.ok) {
        const err = await jsonRes.json();
        alert("JSON 업데이트 실패: " + err.message);
        return;
      }

      alert("업로드 완료 → 새로고침");
    } catch (e) {
      alert("업로드 오류: " + e.message);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadToGitHub(file);
  };

  if (mode === "upload") {
    return (
      <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center gap-6">
        <h1 className="text-lg">Upload</h1>

        <input type="file" accept="video/*" onChange={handleUpload} />

        <div className="text-xs opacity-60 text-center px-6">
          GitHub 직접 업로드
        </div>

        <button
          onClick={() => setMode("viewer")}
          className="bg-white/20 px-4 py-2 rounded-xl"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen bg-black text-white overflow-hidden"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {videos.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <div className="opacity-70 text-sm">No videos</div>
          <button
            onClick={() => setMode("upload")}
            className="bg-white/20 px-4 py-2 rounded-xl"
          >
            Upload
          </button>
        </div>
      ) : (
        <div className="relative h-full w-full">
          <video
            key={videos[current]?.id}
            src={videos[current]?.url}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            loop
            controls
          />

          <div className="absolute bottom-10 left-5 text-sm opacity-80">
            {videos[current]?.title}
          </div>

          <div className="absolute top-5 right-5">
            <button
              onClick={() => setMode("upload")}
              className="bg-white/20 px-3 py-2 rounded-xl text-sm"
            >
              Upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
