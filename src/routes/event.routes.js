const express = require('express');
const router = express.Router();
const {redisClient} = require("../config/redis.config");

// GET /api/events/seller/:sellerId
// For chef/waiter dashboard order updates

router.get("/events/seller/:sellerId", async(req,res)=>{
    try{
        const {sellerId} = req.params;
        const channel = `seller:${sellerId}`;

        res.writeHead(200,{
            "Content-Type":"text/event-stream",
            "Cache-Control":"no-cache",
            "Connection":"keep-alive"
        });
        res.flushHeaders();
        const subscriber = redisClient.duplicate();

        subscriber.subscribe(channel, (err)=>{
            if(err) console.error(`[SSE] subscribe error for ${channel}:`, err.message);
        });

        subscriber.on("message", (channel, message)=>{
            res.write(`data: ${message}\n\n`);
        });

        req.on("close", ()=>{
            subscriber.unsubscribe(channel);
            subscriber.quit();
        });

    }
    catch(err){
        console.error("[events/seller]", err.message);
    }
});

// GET /api/events/table/:sellerId/:tableId
// For customer dashboard — live order status updates for their table
router.get("/events/table/:sellerId/:tableId", async (req, res) => {
    try {
        const { sellerId, tableId } = req.params;
        const channel = `table:${sellerId}:${tableId}`;

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        });
        res.flushHeaders();

        const subscriber = redisClient.duplicate();

        subscriber.subscribe(channel, (err) => {
            if (err) console.error(`[SSE] subscribe error for ${channel}:`, err.message);
        });

        subscriber.on("message", (ch, message) => {
            res.write(`data: ${message}\n\n`);
        });

        req.on("close", () => {
            subscriber.unsubscribe(channel);
            subscriber.quit();
        });
    } catch (err) {
        console.error("[events/table]", err.message);
    }
});

module.exports = router;
