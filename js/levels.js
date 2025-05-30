// levels.js
// 每一关的配置项（可根据需要继续扩展关卡）
const LEVELS = [
  {
    rows: 8,             // 行数
    cols: 8,             // 列数
    colors: 6,           // 宝石种类数
    timeLimit: 300       // 限时（秒），5分钟
  },
  {
    rows: 9,             // 第二关行数
    cols: 9,             // 第二关列数
    colors: 7,           // 第二关宝石种类数
    timeLimit: 300       // 第二关限时（秒）
  }
];

// 调试输出，开发期可用，正式上线可移除
console.log('LEVELS 配置:', LEVELS);
