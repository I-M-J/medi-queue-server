require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
let client = null;
let tutorsCollection = null;
let bookingsCollection = null;

if (uri && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'))) {
    client = new MongoClient(uri);
}
else {
    console.warn("WARNING: MONGODB_URI is not set to a valid connection string. Please check your .env file.");
}

async function connectDB() {
    if (!client) {
        console.warn("Skipping MongoDB connection: client not initialized due to missing or invalid MONGODB_URI.");
        return;
    }

    try {
        await client.connect();

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const db = client.db("mediqueue");
        tutorsCollection = db.collection("tutors");
        bookingsCollection = db.collection("bookings");
    }
    catch (error) {
        console.error("Database connection error:", error);
    }
}

connectDB().catch(console.dir);

const checkDbConnection = (req, res, next) => {
    if (!tutorsCollection || !bookingsCollection) {
        return res.status(503).send({
            message: 'Service Unavailable: Database connection not established. Please check server logs and configuration.'
        });
    }

    next();
};

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ message: 'Unauthorized access: Missing token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const JWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload;
        next();
    }
    catch (error) {
        return res.status(403).send({ message: 'Forbidden access: Invalid token', error: error.message });
    }
};

app.get('/', (req, res) => {
    res.send('MediQueue Tutor Booking Server is running');
});