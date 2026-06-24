const mongoose = require('mongoose');

const connectDB = async() => {
    const uri = process.env.MONGO_URI;
    try{
        await mongoose.connect(uri);
        console.log('Database connected successfully');

        // Drop stale orderId_1 index from orders collection if it exists
        try {
            const db = mongoose.connection.db;
            const indexes = await db.collection('orders').indexes();
            const stale = indexes.find(i => i.name === 'orderId_1');
            if (stale) {
                await db.collection('orders').dropIndex('orderId_1');
                console.log('[db] dropped stale index: orderId_1');
            }
        } catch (idxErr) {
            // Non-fatal — collection may not exist yet
            console.warn('[db] index cleanup skipped:', idxErr.message);
        }
    }
    catch(err){
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }
}
module.exports = connectDB;