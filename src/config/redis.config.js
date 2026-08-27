// redis.config.js
const Redis = require("ioredis");

const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on("connect", () => console.log("Redis connected"));
redisClient.on("error", (err) => console.error("Redis error:", err));

const redisPublish = async (channel, data) => {
    try {
        await redisClient.publish(channel, JSON.stringify(data));
    } catch (err) {
        console.error("Redis publish error:", err);
    }
};

module.exports = { redisClient, redisPublish };