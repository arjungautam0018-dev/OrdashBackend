// middleware/apiTimer.js

const apiTimer = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const time = Number(end - start) / 1_000_000;

    let color = "\x1b[32m"; // Green

    if (time >= 200 && time < 500) {
      color = "\x1b[33m"; // Yellow
    } else if (time >= 500) {
      color = "\x1b[31m"; // Red
    }

    console.log(
      `${color}[API] ${req.method} ${req.originalUrl} → ${res.statusCode} | ${time.toFixed(2)}ms\x1b[0m`
    );
  });

  next();
};

module.exports = apiTimer;