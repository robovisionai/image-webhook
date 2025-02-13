// Required libraries
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware for parsing JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic route for room-based webhook handling
app.post('/:room', upload.any(), (req, res) => {
    const room = req.params.room;

    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded');
    }

    // Filter image files (JPEG/PNG) and process them
    const imageFiles = req.files.filter(file => file.mimetype === 'image/jpeg' || file.mimetype === 'image/png');
    const predictionsFile = req.files.find(file => file.fieldname === 'predictions');

    const imageDataArray = imageFiles.map(file => {
        const imagePath = path.join(__dirname, file.path);
        const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });
        const filename = file.originalname;
        fs.unlinkSync(imagePath); // Cleanup uploaded file
        return { data: `data:${file.mimetype};base64,${base64Image}`, filename };
    });

    const images = imageDataArray.map(item => item.data);
    const filenames = imageDataArray.map(item => item.filename);

    let predictionsData = null;
    if (predictionsFile) {
        const predictionsPath = path.join(__dirname, predictionsFile.path);
        predictionsData = JSON.parse(fs.readFileSync(predictionsPath, 'utf-8'));
        fs.unlinkSync(predictionsPath); // Cleanup uploaded file
    }

    // Emit to the room with all images and predictions
    io.to(room).emit('update', { images, filenames, predictions: predictionsData });

    res.send('Files uploaded successfully');
});

// Dynamic room creation and joining
io.on('connection', (socket) => {
    console.log('A client connected');

    socket.on('join', (room) => {
        socket.join(room);
        console.log(`Client joined room: ${room}`);
    });
});

// Catch-all route to serve unique rooms
app.get('/:room', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
