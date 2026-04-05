/**
 * generateVideo.js
 * BIM/AECニュースからYouTube動画を自動生成する
 *
 * 処理フロー:
 *   記事 → スクリプト生成（Claude） → 音声生成（Google TTS） → スライド画像生成（ImageMagick） → 動画合成（FFmpeg）
 *
 * 実行環境:
 *   - ローカル: ImageMagick・FFmpegのインストールが必要
 *   - GitHub Actions: ubuntu-latestにプリインストール済み（追加設定不要）
 *
 * 使い方:
 *   const { generateVideo, generateWeeklyDigestVideo } = require("./generateVideo.js");
 */

const { execSync } = require("child_process");
const https  = require("https");
const fs     = require("fs");
const path   = require("path");

const Anthropic = require("@anthropic-ai/sdk");

const VIDEOS_DIR    = path.join(__dirname, "data", "videos");
const TEMP_DIR      = path.join(__dirname, "data", "video_tmp");
const GOOGLE_TTS_KEY = process.env.GOOGLE_CLOUD_API_KEY;

// ─────────────────────────────────────────────────────────────
// ディレクトリ準備
// ─────────────────────────────────────────────────────────────

function ensureDirs() {
  [VIDEOS_DIR, TEMP_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

// ─────────────────────────────────────────────────────────────
// 1. スクリプト生成（Claude API）
// ─────────────────────────────────────────────────────────────

/**
 * 記事から動画ナレーション用スクリプトを生成する
 * @param {object} article
 * @returns {Promise<{ title: string, slides: { heading: string, body: string, narration: string }[] }>}
 */
async function generateScript(article) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `あなたはBIM/AEC業界の専門家です。
以下の記事をもとに、YouTube動画（60〜90秒）のスクリプトをJSON形式で作成してください。

## 記事情報
タイトル: ${article.title}
内容: ${(article.xPostBody || article.japaneseSummary || article.summary || "").slice(0, 500)}
URL: ${article.link}

## 出力形式（JSONのみ、前置き不要）
{
  "title": "動画タイトル（40字以内・検索されやすい）",
  "slides": [
    {
      "heading": "スライド見出し（20字以内）",
      "body": "スライド本文（60字以内）",
      "narration": "ナレーション（40〜60字・自然な話し言葉）"
    }
  ]
}

## スライド構成（4枚固定）
1. タイトルスライド（記事のテーマを一言で）
2. 背景・概要（何が起きているか）
3. 注目ポイント（現場への影響・なぜ重要か）
4. まとめ（チャンネル登録を促す締め）`;

  const response = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages:   [{ role: "user", content: prompt }],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("スクリプトのJSON解析に失敗");

  return JSON.parse(jsonMatch[0]);
}

// ─────────────────────────────────────────────────────────────
// 2. 音声生成（Google Cloud TTS REST API）
// ─────────────────────────────────────────────────────────────

function googleTtsRequest(text, outputPath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      input:       { text },
      voice:       { languageCode: "ja-JP", name: "ja-JP-Neural2-B" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.05, pitch: 0 },
    });

    const options = {
      hostname: "texttospeech.googleapis.com",
      path:     `/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
      method:   "POST",
      headers:  { "Content-Type": "application/json" },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (!json.audioContent) return reject(new Error("TTS失敗: " + JSON.stringify(json)));
          const buf = Buffer.from(json.audioContent, "base64");
          fs.writeFileSync(outputPath, buf);
          resolve(outputPath);
        } catch (e) { reject(e); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function generateAudio(slides, prefix) {
  const audioPaths = [];
  for (let i = 0; i < slides.length; i++) {
    const outPath = path.join(TEMP_DIR, `${prefix}_audio_${i}.mp3`);
    await googleTtsRequest(slides[i].narration, outPath);
    audioPaths.push(outPath);
    await new Promise((r) => setTimeout(r, 200));
  }
  return audioPaths;
}

// ─────────────────────────────────────────────────────────────
// 3. スライド画像生成（ImageMagick）
// ─────────────────────────────────────────────────────────────

const BG_COLOR     = "#1a1a2e";  // ダークネイビー
const ACCENT_COLOR = "#4a9eff";  // ブルー
const TEXT_COLOR   = "#ffffff";
const WIDTH  = 1280;
const HEIGHT = 720;

function escapeForIM(text) {
  return text.replace(/[\\'"&<>|]/g, " ");
}

function generateSlideImage(slide, index, prefix, isTitle = false) {
  const outPath = path.join(TEMP_DIR, `${prefix}_slide_${index}.png`);

  let cmd;

  if (isTitle) {
    // タイトルスライド
    cmd = `convert -size ${WIDTH}x${HEIGHT} xc:"${BG_COLOR}" ` +
      `-fill "${ACCENT_COLOR}" -draw "rectangle 0,${HEIGHT - 8},${WIDTH},${HEIGHT}" ` +
      `-fill "${ACCENT_COLOR}" -font "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" ` +
      `-pointsize 18 -gravity NorthWest -annotate +60+60 "BIM/AEC NEWS" ` +
      `-fill "${TEXT_COLOR}" -font "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc" ` +
      `-pointsize 48 -gravity Center -annotate +0-40 "${escapeForIM(slide.heading)}" ` +
      `-pointsize 24 -gravity Center -annotate +0+60 "${escapeForIM(slide.body)}" ` +
      `"${outPath}"`;
  } else {
    // コンテンツスライド
    cmd = `convert -size ${WIDTH}x${HEIGHT} xc:"${BG_COLOR}" ` +
      `-fill "${ACCENT_COLOR}" -draw "rectangle 0,0,6,${HEIGHT}" ` +
      `-fill "${ACCENT_COLOR}" -font "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" ` +
      `-pointsize 36 -gravity NorthWest -annotate +40+60 "${escapeForIM(slide.heading)}" ` +
      `-fill "${TEXT_COLOR}" -font "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc" ` +
      `-pointsize 28 -gravity West -annotate +40+20 "${escapeForIM(slide.body)}" ` +
      `-fill "#888888" -pointsize 18 -gravity SouthEast -annotate +40+30 "BIM/AEC News" ` +
      `"${outPath}"`;
  }

  execSync(cmd);
  return outPath;
}

function generateSlideImages(slides, prefix) {
  return slides.map((slide, i) =>
    generateSlideImage(slide, i, prefix, i === 0)
  );
}

// ─────────────────────────────────────────────────────────────
// 4. MP3の長さ取得
// ─────────────────────────────────────────────────────────────

function getAudioDuration(mp3Path) {
  try {
    const result = execSync(
      `ffprobe -i "${mp3Path}" -show_entries format=duration -v quiet -of csv=p=0`
    ).toString().trim();
    return parseFloat(result) || 5;
  } catch {
    return 5;
  }
}

// ─────────────────────────────────────────────────────────────
// 5. 動画合成（FFmpeg）
// ─────────────────────────────────────────────────────────────

function buildVideo(slidePaths, audioPaths, outputPath) {
  // 各スライドの表示時間 = 対応する音声の長さ + 0.5秒
  const durations = audioPaths.map((p) => getAudioDuration(p) + 0.5);

  // concat用のinputリストを作成
  const listFile = outputPath.replace(".mp4", "_list.txt");
  const entries  = [];

  for (let i = 0; i < slidePaths.length; i++) {
    const tmpVideo = outputPath.replace(".mp4", `_seg${i}.mp4`);

    // スライド画像 + 音声 → 動画セグメント
    execSync(
      `ffmpeg -y -loop 1 -i "${slidePaths[i]}" -i "${audioPaths[i]}" ` +
      `-c:v libx264 -tune stillimage -c:a aac -b:a 128k ` +
      `-t ${durations[i].toFixed(2)} -pix_fmt yuv420p "${tmpVideo}"`,
      { stdio: "ignore" }
    );

    entries.push(`file '${tmpVideo}'`);
  }

  fs.writeFileSync(listFile, entries.join("\n"), "utf-8");

  // セグメントを結合
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`,
    { stdio: "ignore" }
  );

  // 一時ファイルの掃除
  entries.forEach((e) => {
    const f = e.replace("file '", "").replace("'", "");
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
}

// ─────────────────────────────────────────────────────────────
// メイン: 1記事から動画を生成
// ─────────────────────────────────────────────────────────────

/**
 * 1件の記事から動画を生成する
 * @param {object} article
 * @returns {Promise<{ videoPath: string, title: string } | null>}
 */
async function generateVideo(article) {
  if (!process.env.ANTHROPIC_API_KEY || !GOOGLE_TTS_KEY) {
    console.log("[Video] ANTHROPIC_API_KEY または GOOGLE_CLOUD_API_KEY が未設定 — スキップ");
    return null;
  }

  ensureDirs();

  const prefix = `video_${Date.now()}`;
  console.log(`[Video] 生成開始: ${article.title?.slice(0, 50)}`);

  try {
    // 1. スクリプト生成
    const script = await generateScript(article);
    console.log(`[Video] スクリプト完了: ${script.title}`);

    // 2. 音声生成
    const audioPaths = await generateAudio(script.slides, prefix);
    console.log(`[Video] 音声生成完了: ${audioPaths.length}件`);

    // 3. スライド画像生成
    const slidePaths = generateSlideImages(script.slides, prefix);
    console.log(`[Video] スライド生成完了: ${slidePaths.length}枚`);

    // 4. 動画合成
    const slug      = article.link?.split("/").filter(Boolean).pop() || prefix;
    const videoPath = path.join(VIDEOS_DIR, `${slug}.mp4`);
    buildVideo(slidePaths, audioPaths, videoPath);
    console.log(`[Video] 動画生成完了: ${videoPath}`);

    // 一時ファイル掃除
    [...audioPaths, ...slidePaths].forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    return { videoPath, title: script.title, script };

  } catch (err) {
    console.error(`[Video] 生成失敗: ${err.message}`);
    return null;
  }
}

/**
 * 複数記事から動画をバッチ生成する（上位N件）
 * @param {object[]} articles
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function generateVideos(articles, limit = 1) {
  const targets = articles.slice(0, limit);
  const results = [];

  for (const article of targets) {
    const result = await generateVideo(article);
    if (result) results.push(result);
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}

module.exports = { generateVideo, generateVideos };
