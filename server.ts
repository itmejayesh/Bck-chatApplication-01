import {Server} from "socket.io";
import {createServer} from "http";
import crypto from "crypto";
import SessionStore from "./SessionStore";
import MessageStore from "./MessageStore";

const store = new SessionStore();
const messageStore = new MessageStore();
const http = createServer();
const io = new Server(http, {
	cors: {
		origin: ["http://localhost:3000"],
	},
});

//On the server-side, we register a middleware which checks the username and allows the
//connection: using user id and session id
io.use((socket: any, next) => {
	//we get the username from socket.auth = {username} which is present in client side
	const sessionID = socket.handshake.auth.sessionID;
	console.log("sessionID: " + sessionID);

	// find existing session
	if (sessionID) {
		const session = store.findSession(sessionID);
		if (session) {
			socket.sessionID = sessionID;
			socket.userID = session.userID;
			socket.username = session.username;
		}
		return next();
	}

	const username = socket.handshake.auth.username;
	if (!username) {
		return next(new Error("Invalid username"));
	}

	console.log("sessionID not exist", sessionID);

	// create new session
	socket.username = username;
	socket.userID = crypto.randomBytes(8).toString("hex");
	socket.sessionID = crypto.randomBytes(8).toString("hex");
	store.saveSesion(socket.sessionID, {
		userID: socket.userID,
		username: socket.username,
		connected: true,
	});
	next();
});

io.on("connection", (socket: any) => {
	const users: any = [];
	const message = messageStore.findMessagesForUser(socket.userID);
	const messageInfo = new Map();
	if (message) {
		message.forEach((message: any) => {
			const otheruser = message.from === socket.userID ? message.to : message.from;
			if (messageInfo.has(otheruser)) {
				messageInfo.get(otheruser).push(message);
			} else {
				messageInfo.set(otheruser, [message]);
			}
		});
	}
	console.log(messageInfo);

	store.findAllSession().forEach((session) => {
		users.push({
			userID: session.userID,
			username: session.username,
			connected: session.connected,
			message: messageInfo.get(session.userID) || [],
		});
	});

	socket.join(socket.userID);
	socket.emit("users", users);

	// notify existing users
	socket.broadcast.emit("user connected", {
		userID: socket.userID,
		username: socket.username,
		connected: true,
	});

	//also emit users session details from server to client
	socket.emit("session", {
		sessionID: socket.sessionID,
		userID: socket.userID,
	});

	socket.on("private message", ({content, to}: any) => {
		socket.to(to).to(socket.userID).emit("private message", {
			content,
			from: socket.userID,
		});
	});

	socket.on("disconnect", async () => {
		const matchingSockets = await io.in(socket.userID).allSockets();
		const isDisconnected = matchingSockets.size === 0;
		if (isDisconnected) {
			socket.broadcast.emit("user disconnected", socket.userID);
			store.saveSesion(socket.sessionID, {
				userID: socket.userID,
				username: socket.username,
				connected: false,
			});
		}
	});
});

http.listen(8080);
