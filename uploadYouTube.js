/**
 * uploadYouTube.js
 * 生成した動画をYouTubeに自動アップロードする
 *
 * 使い方:
 *   const { uploadVideo } = require("./uploadYouTube.js");
 *   await uploadVideo({ videoPath, title, description, tags });
 */

const fs      = require("fs");
const https   = require("https");
const path    = require("path");

// ─────────────────────────────────────────────────────────────
// OAuth2トークン取得（リフレッシュトークンから）
// ─────────────────────────────────────────────────────────────

async function refreshAccessToken() {
  const body = new URLSearchParams({
    client_id:     process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    grant_type:    "refresh_token",
  }).toString();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "oauth2.googleapis.com",
      path:     "/token",
      method:   "POST",
      headers:  {
        "Content-Type":   "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (!json.access_token) reject(new Error("トークン取得失敗: " + data));
          else resolve(json.access_token);
        } catch (e) { reject(e); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────
// YouTube Data API v3 アップロード
// ─────────────────────────────────────────────────────────────

async function uploadVideo({ videoPath, title, description = "", tags = [] }) {
  const required = [
    "YOUTUBE_CLIENT_ID",
    "YOUTUBE_CLIENT_SECRET",
    "YOUTUBE_REFRESH_TOKEN",
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.log(`[YouTube] ${key} 未設定 — アップロードスキップ`);
      return null;
    }
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`[YouTube] 動画ファイルが見つかりません: ${videoPath}`);
    return null;
  }

  console.log(`[YouTube] アップロード開始: ${title}`);

  const accessToken = await refreshAccessToken();
  const fileSize    = fs.statSync(videoPath).size;

  // メタデータ
  const metadata = JSON.stringify({
    snippet: {
      title:       title.slice(0, 100),
      description: `${description}\n\n#BIM #AEC #建設DX #建設テック\n\n最新のBIM/AEC業界ニュースを毎日お届けしています。チャンネル登録お願いします。`,
      tags:        [...tags, "BIM", "AEC", "建設DX", "建築", "Revit", "建設テック"],
      categoryId:  "28", // Science & Technology
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  });

  // Resumable uploadセッション取得
  const uploadUrl = await new Promise((resolve, reject) => {
    const options = {
      hostname: "www.googleapis.com",
      path:     "/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      method:   "POST",
      headers:  {
        "Authorization":   `Bearer ${accessToken}`,
        "Content-Type":    "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": fileSize,
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve(res.headers.location);
      } else {
        let d = "";
        res.on("data", (c) => { d += c; });
        res.on("end", () => reject(new Error(`セッション取得失敗 ${res.statusCode}: ${d}`)));
      }
    });

    req.on("error", reject);
    req.write(metadata);
    req.end();
  });

  // 動画ファイルをアップロード
  const videoId = await new Promise((resolve, reject) => {
    const url     = new URL(uploadUrl);
    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   "PUT",
      headers:  {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type":  "video/mp4",
        "Content-Length": fileSize,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.id) {
            console.log(`[YouTube] アップロード完了: https://youtube.com/watch?v=${json.id}`);
            resolve(json.id);
          } else {
            reject(new Error("動画ID取得失敗: " + data));
          }
        } catch (e) { reject(e); }
      });
    });

    req.on("error", reject);
    fs.createReadStream(videoPath).pipe(req);
  });

  return videoId;
}

module.exports = { uploadVideo };
