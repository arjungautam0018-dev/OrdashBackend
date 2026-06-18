const mongoose = require('mongoose');

const connectDB = async() => {
    const uri = process.env.MONGO_URI;
    try{
        await mongoose.connect(uri);
        console.log('Database connected successfully');
    }
    catch(err){
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }
}
module.exports = connectDB;