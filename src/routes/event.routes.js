const express = require('express');
const router = express.Router();
const {redisCLient} = require("../config/redis.config");

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
        const subscriber = redisCLient.duplicate();

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

module.exports = router;
