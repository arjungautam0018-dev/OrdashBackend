const http = require("http");
const app = require("./api/index");
const { initSocket } = require("./src/config/socket.config");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => console.log(`[server] running on port ${PORT}`));
