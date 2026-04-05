// scheduler.js
// 実行: node scheduler.js
// 説明: 1日3回の決まった時間にニュース収集・投稿を自動実行する

const cron = require("node-cron");
const { spawn } = require("child_process");
const path = require("path");

const SCHEDULES = [
  { cron: "0 7 * * *", label: "朝便  (07:00 JST)" },
  { cron: "0 12 * * *", label: "昼便  (12:00 JST)" },
  { cron: "0 20 * * *", label: "夜便  (20:00 JST)" },
];

let isRunning = false;

function timestamp() {
  return new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function runNewsCollection(trigger) {
  if (isRunning) {
    console.log(`[${timestamp()}] ⏭ 前回の実行がまだ完了していません。スキップします。`);
    return;
  }

  isRunning = true;
  console.log(`\n[${timestamp()}] ▶ ニュース収集開始 (${trigger})`);

  const newsScript = path.join(__dirname, "news.js");
  const child = spawn("node", [newsScript], {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

  child.on("close", (code) => {
    isRunning = false;
    if (code === 0) {
      console.log(`[${timestamp()}] ✅ ニュース収集完了 (終了コード: ${code})`);
    } else {
      console.log(`[${timestamp()}] ❌ ニュース収集失敗 (終了コード: ${code})`);
    }
  });

  child.on("error", (err) => {
    isRunning = false;
    console.error(`[${timestamp()}] ❌ 実行エラー:`, err.message);
  });
}

// スケジュール登録
for (const schedule of SCHEDULES) {
  cron.schedule(schedule.cron, () => runNewsCollection(schedule.label), {
    timezone: "Asia/Tokyo",
  });
}

// 起動メッセージ
console.log("");
console.log("BIM/AEC ニュース自動投稿スケジューラ 起動");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("スケジュール:");
for (const schedule of SCHEDULES) {
  console.log(`  ${schedule.label}`);
}
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Ctrl+C で停止");
console.log("");

// --now オプション: 即時実行
if (process.argv.includes("--now")) {
  console.log(`[${timestamp()}] --now オプション検出。即時実行します。`);
  runNewsCollection("即時実行 (--now)");
}
