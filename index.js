var express = require('express');
var http = require('http');
var socketIO = require('socket.io');

var globalData = require('./data.json');

var app = express();
var httpServer = http.Server(app);
var io = socketIO(httpServer);

app.use(express.static('public'));

io.on('connection', function (socket) {
    /* console.log('a user connected');
    console.log('Testing socket.io...');
    console.log('Pinging client...');
    console.log('Server: Ping');
    socket.emit('clientping', 'Ping');
    socket.on('clientping', (msg) => {
        console.log('Client: ' + msg);
    });
    socket.on('serverping', () => {
        socket.emit('serverping', 'Pong');
    }); */
    socket.on('response', handleResponse);
    socket.on('info', handleInfo);
    var rid = createHandlerId();
    handlers[rid] = {
        type: 'cookieResponse',
        data: { socket: socket },
        issued: Date.now()
    }
    socket.emit('request', {
        msg: 'sendUserCookie',
        rid: rid
    });
});

httpServer.listen(2608, function () {
    console.log('listening...');
});

var gamedata = [
    {
        name: 'Raum 1',
        status: 0,
        paused: false,
        pauseState: '',
        resumeFunction: null,
        rounds: 20,
        round: 5,
        players: [],
        bannedPlayers: [],
        trump: null,
        cardsOnTable: [],
        roundOpenedBy: 0,
        trickRound: 0,
        trickRoundOpenedBy: 0,
        blacklistedCards: [],
        infoBox: [],
        inactivityToken: 0
    },
    {
        name: 'Raum 2',
        status: 0,
        paused: false,
        pauseState: '',
        resumeFunction: null,
        rounds: 20,
        round: 5,
        players: [],
        bannedPlayers: [],
        trump: null,
        cardsOnTable: [],
        roundOpenedBy: 0,
        trickRound: 0,
        trickRoundOpenedBy: 0,
        blacklistedCards: [],
        infoBox: [],
        inactivityToken: 0
    },
    {
        name: 'Raum 3',
        status: 0,
        paused: false,
        pauseState: '',
        resumeFunction: null,
        rounds: 20,
        round: 5,
        players: [],
        bannedPlayers: [],
        trump: null,
        cardsOnTable: [],
        roundOpenedBy: 0,
        trickRound: 0,
        trickRoundOpenedBy: 0,
        blacklistedCards: [],
        infoBox: [],
        inactivityToken: 0
    },
    {
        name: 'Raum 4',
        status: 0,
        paused: false,
        pauseState: '',
        resumeFunction: null,
        rounds: 20,
        round: 5,
        players: [],
        bannedPlayers: [],
        trump: null,
        cardsOnTable: [],
        roundOpenedBy: 0,
        trickRound: 0,
        trickRoundOpenedBy: 0,
        blacklistedCards: [],
        infoBox: [],
        inactivityToken: 0
    },
    {
        name: 'Raum 5',
        status: 0,
        paused: false,
        pauseState: '',
        resumeFunction: null,
        rounds: 20,
        round: 5,
        players: [],
        bannedPlayers: [],
        trump: null,
        cardsOnTable: [],
        roundOpenedBy: 0,
        trickRound: 0,
        trickRoundOpenedBy: 0,
        blacklistedCards: [],
        infoBox: [],
        inactivityToken: 0
    }
]

var handlers = {};

var userdata = {};

var lobbySubscribers = [];

setInterval(() => {
    var now = Date.now();
    for (var handler in handlers) {
        if (now - handlers[handler].issued > 24 * 60 * 60 * 1000) delete handlers[handler]; //if older than 1d
    }
}, 60 * 60 * 1000) //every hour

function createHandlerId() {
    var id;
    var map = 'abcdefghijklmnopqrstuvwxyz'
    do {
        id = '';
        for (var i = 0; i < 20; i++) {
            id += map[Math.floor(Math.random() * 26)];
        }
    } while (id in handlers);
    return id;
}

function handleResponse(response) {
    if (!(response.rid in handlers)) return;
    switch(handlers[response.rid].type) {
        case 'cookieResponse':
            handleCookieResponse(response);
            break;
        case 'rejoinResponse':
            handleRejoinResponse(handlers[response.rid].data.uid, response.data);
            break;
        case 'nickResponse':
            handleNickResponse(response);
            break;
        case 'joinLobby':
            handleLobbyJoin(response);
            break;
        case 'kickPlayer':
            removePlayer(handlers[response.rid].data, true);
            break;
        case 'leavingLobby':
            removePlayer(handlers[response.rid].data.uid, false);
            break;
        case 'addBot':
            addBot(handlers[response.rid].data.uid);
            break;
        case 'launchGame':
            launchGame(handlers[response.rid].data.table);
            break;
        case 'trumpChoice':
            var uid = handlers[response.rid].data.uid;
            var tableId = handlers[response.rid].data.tableId;
            userdata[uid].gameStatus = 0;
            if ((['r', 'g', 'y', 'b']).indexOf(gamedata[tableId].trump) == -1)
                gamedata[tableId].trump = (['r', 'g', 'y', 'b'])[Math.floor(Math.random() * 4)];
            announceTrump(tableId);
            break;
        case 'tricksConfirmed':
            confirmTricks(handlers[response.rid].data.table, handlers[response.rid].data.player);
            break;
        case 'cardConfirmed':
            confirmCard(handlers[response.rid].data.table, handlers[response.rid].data.player, handlers[response.rid].data.startPlayer, response.data);
            break;
        case 'chatMsg':
            var uid = handlers[response.rid].data.uid;
            var regex = /[<>\f\n\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;
            if (!regex.test(response.data)) {
                tableAnnounce(userdata[uid].table, { msg: 'newChatMsg', data: { name: userdata[uid].name, text: response.data } });
            }
            requestToClient(uid, 'chatMsg', { uid: uid }, 'chatToken');
            break;
        case 'pauseGame':
            gamedata[handlers[response.rid].data.table].infoBox.push({ evt: 'gamePaused', data: null });
            break;
        case 'resumeGame':
            gamedata[handlers[response.rid].data.table].infoBox.push({ evt: 'gameResumed', data: handlers[response.rid].data.callback });
            if (gamedata[handlers[response.rid].data.table].infoBox.length == 1) processInfoBox(
                handlers[response.rid].data.table,
                gamedata[handlers[response.rid].data.table].pauseState,
                () => {}
            );
            break;
        case 'endGame':
            gamedata[handlers[response.rid].data.table].rounds = gamedata[handlers[response.rid].data.table].round + 1;
            break;
    }
    delete handlers[response.rid];
}

function handleInfo(info) {
    switch(info.msg) {
        case 'updateMaxRounds':
            roundsChanged(info.data.uid, info.data.value);
            break;
        case 'trickCount':
            if (userdata[info.data.uid].gameStatus == 1) userdata[info.data.uid].predictedTricks = info.data.value;
            break;
        case 'cardIndex':
            if (userdata[info.data.uid].gameStatus == 2) userdata[info.data.uid].selectedCardIndex = info.data.value;
            break;
        case 'trump':
            if (userdata[info.data.uid].gameStatus == 3) gamedata[userdata[info.data.uid].table].trump = info.data.value;
            break;
    }
}

function handleCookieResponse(response) {
    if (response.data in userdata) {
        if (userdata[response.data].isConnected) handlers[response.rid].data.socket.emit('info', {
            msg: 'multipleConnections',
            data: null
        });
        else {
            userdata[response.data].isConnected = true;
            userdata[response.data].socket = handlers[response.rid].data.socket;
            var players = [];
            for (var i = 0; i < gamedata[userdata[response.data].table].players.length; i++) {
                if (gamedata[userdata[response.data].table].players[i] != response.data) {
                    players.push(userdata[gamedata[userdata[response.data].table].players[i]].name);
                }
            }
            sendClientInfo(response.data, 'rejoinData', {
                tableName: gamedata[userdata[response.data].table].name,
                round: gamedata[userdata[response.data].table].round,
                players: players
            });
            requestToClient(response.data, 'rejoinResponse', { uid: response.data }, 'rejoinToken');
            userdata[response.data].socket.on('disconnect', () => { playerDisconnected(response.data) });
        }
    } else {
        addNewUserRecord(response.data, handlers[response.rid].data.socket);
    }
}

function handleRejoinResponse(uid, response) {
    var tableId = userdata[uid].table;
    var index = 0;
    while (gamedata[tableId].players[index] != uid) index++;
    if (response) {
        gamedata[tableId].infoBox.push({ evt: 'playerRejoined', data: index });
        if (gamedata[tableId].inactivityToken != 0) {
            gamedata[tableId].inactivityToken = 0;
            for (var i = 0; i < gamedata[tableId].players.length; i++) 
                userdata[gamedata[tableId].players[i]].isHost = (gamedata[tableId].players[i] == uid);
        }
        if (gamedata[tableId].paused) processInfoBox(tableId, gamedata[tableId].pauseState, () => {});
    } else {
        replacePlayerWithBot(uid, tableId);
        requestToClient(uid, 'nickResponse', { uid: uid }, 'sendNickname');
    }
}

function replacePlayerWithBot(uid, tableId) {
    var botuid = createHandlerId();
    var index = 0;
    while (gamedata[tableId].players[index] != uid) index++;
    createBotRecord(
        botuid,
        userdata[uid].status,
        userdata[uid].name,
        tableId,
        '',
        userdata[uid].tricks,
        userdata[uid].predictedTricks,
        userdata[uid].credits,
        JSON.parse(JSON.stringify(userdata[uid].cards))
    );
    gamedata[tableId].players[index] = botuid;
    userdata[uid].status = 0;
    userdata[uid].gameStatus = 0;
    userdata[uid].isHost = false;
    userdata[uid].isBot = false;
    userdata[uid].table = null;
    userdata[uid].kickRid = '';
    userdata[uid].tricks = 0;
    userdata[uid].predictedTricks = 0;
    userdata[uid].credits = 0;
    userdata[uid].cards = {};
    userdata[uid].selectedCardIndex = '0';
    userdata[uid].timeFailCount = 0;
    var keepGame = false;
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        var id = gamedata[tableId].players[i];
        if (userdata[id].cannotRejoin !== true) keepGame = true;
    }
    if (!keepGame) endGame(tableId);
}

function handleNickResponse(response) {
    var uid = handlers[response.rid].data.uid;
    userdata[uid].name = response.data;
    lobbySubscribers.push(uid);
    lobbiesChangeTrigger();
    requestToClient(uid, 'joinLobby', { uid: uid }, 'selectLobby');
}

function handleLobbyJoin(response) {
    var uid = handlers[response.rid].data.uid;
    if (gamedata[response.data].bannedPlayers.indexOf(uid) != -1 && gamedata[response.data].players.length < 6) return;
    userdata[uid].table = response.data;
    userdata[uid].status = 1;
    gamedata[response.data].status = 1;
    gamedata[response.data].players.push(uid);
    if (gamedata[response.data].players.length == 1) {
        userdata[uid].isHost = true;
        requestToClient(uid, 'addBot', { uid: uid }, 'addBotTrigger');
        requestToClient(uid, 'launchGame', { table: response.data }, 'startGameToken');
    } else {
        var rid = createHandlerId();
        userdata[uid].kickRid = rid;
        userdata[uid].handlerList.push(rid);
        handlers[rid] = {
            type: 'kickPlayer',
            data: uid,
            issued: Date.now()
        }
    }
    requestToClient(uid, 'leavingLobby', { uid: uid }, 'leaveLobby');
    if (gamedata[response.data].players.length * gamedata[response.data].rounds > 60) 
        gamedata[response.data].rounds = 60 / gamedata[response.data].players.length;
    lobbiesChangeTrigger();
    lobbyChangeTrigger(response.data);
}

function removePlayer(uid, isKicked) {
    var tableId = userdata[uid].table;
    if (gamedata[tableId].status != 1) return;
    var index = 0;
    while (uid != gamedata[tableId].players[index]) index++;
    gamedata[tableId].players.splice(index, 1);
    if (userdata[uid].isHost) {
        var newHostId;
        var i;
        for (i = gamedata[tableId].players.length - 1; i >= 0; i--) {
            if (!userdata[gamedata[tableId].players[i]].isBot) newHostId = i;
        }
        if (newHostId != undefined) {
            newUid = gamedata[tableId].players[newHostId];
            userdata[newUid].kickRid = '';
            userdata[newUid].isHost = true;
            sendClientInfo(newUid, 'youAreHost', null);
            requestToClient(newUid, 'addBot', { uid: newUid }, 'addBotTrigger');
        } else {
            for (var i = 0; i < gamedata[tableId].players.length; i++) {
                var botUid = gamedata[tableId].players[i];
                deleteHandlers(botUid);
                delete userdata[botUid];
            }
            gamedata[tableId].status = 0;
            gamedata[tableId].rounds = 20;
            gamedata[tableId].players = [];
        }
    }
    lobbiesChangeTrigger();
    lobbyChangeTrigger(tableId);
    if (isKicked) {
        gamedata[tableId].bannedPlayers.push(uid);
        setTimeout(() => { 
            gamedata[tableId].bannedPlayers = gamedata[tableId].bannedPlayers.filter(str => str != uid);
            sendClientInfo(uid, 'banExpired', tableId);
        }, 56000);
        sendClientInfo(uid, 'youHaveBeenKicked', tableId);
    } 
    userdata[uid].status = 0;
    userdata[uid].table = null;
    userdata[uid].isHost = false;
    userdata[uid].kickRid = '';
    deleteHandlers(uid);
    if (userdata[uid].isConnected) requestToClient(uid, 'joinLobby', { uid: uid }, 'selectLobby');
    if (userdata[uid].isBot) delete userdata[uid];
}

function addBot(uid) {
    var lobby = userdata[uid].table;
    if (gamedata[lobby].players.length < 6 && userdata[uid].isHost) {
        var botUid = createHandlerId();
        var botName = '';
        do botName = globalData.botNames[Math.floor(Math.random() * globalData.botNames.length)]; while ((() => {
            for (var i = 0; i < gamedata[lobby].players.length; i++) {
                if (botName == userdata[gamedata[lobby].players[i]].name) return true;
            }
            return false;
        })());
        var rid = createHandlerId();
        handlers[rid] = {
            type: 'kickPlayer',
            data: botUid,
            issued: Date.now()
        };
        createBotRecord(botUid, 1, botName, lobby, rid, 0, 0, 0, {});
        gamedata[lobby].players.push(botUid);
        if (gamedata[lobby].players.length * gamedata[lobby].rounds > 60)
            gamedata[lobby].rounds = 60 / gamedata[lobby].players.length;
        lobbiesChangeTrigger();
        lobbyChangeTrigger(lobby);
        requestToClient(uid, 'addBot', { uid: uid }, 'addBotTrigger');
    }
}

function createBotRecord(uid, status, name, table, kickRid, tricks, predictedTricks, credits, cards) {
    userdata[uid] = {
        socket: null,
        status: status,
        name: name,
        isHost: false,
        isBot: true,
        table: table,
        kickRid: kickRid,
        handlerList: [kickRid],
        tricks: tricks,
        predictedTricks: predictedTricks,
        credits: credits,
        cards: cards,
        cardsShown: false,
        selectedCardIndex: '0',
        colors: null,
        cannotRejoin: true
    }
}

function addNewUserRecord(uid, socket) {
    userdata[uid] = {
        socket: socket,
        isConnected: true,
        status: 0,
        gameStatus: 0,
        name: '',
        isHost: false,
        isBot: false,
        table: null,
        kickRid: '',
        handlerList: [],
        tricks: 0,
        predictedTricks: 0,
        credits: 0,
        cards: {},
        cardsShown: false,
        selectedCardIndex: '0',
        colors: null,
        timeFailCount: 0
    }
    socket.on('disconnect', () => { playerDisconnected(uid) });
    requestToClient(uid, 'nickResponse', { uid: uid }, 'sendNickname');
    var bannedInLobbies = [];
    for (var i = 0; i < gamedata.length; i++) {
        if (gamedata[i].bannedPlayers.indexOf(uid) == -1) bannedInLobbies.push(false);
        else bannedInLobbies.push(true);
    }
    sendClientInfo(uid, 'bannedInLobbies', bannedInLobbies);
}

function tableAnnounce(tableId, message) {
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        var uid = gamedata[tableId].players[i];
        if (userdata[uid] == undefined) continue;
        if (!userdata[uid].isBot) userdata[uid].socket.emit('info', message);
    }
}

function requestToClient(uid, type, data, msg) {
    if (userdata[uid] == undefined) return;
    var socket = userdata[uid].socket;
    if (socket == null) return;
    var rid = createHandlerId();
    userdata[uid].handlerList.push(rid);
    handlers[rid] = {
        type: type,
        data: data,
        issued: Date.now()
    }
    socket.emit('request', {
        msg: msg,
        rid: rid
    });
    return rid;
}

function sendClientInfo(uid, msg, data) {
    if (userdata[uid] == undefined) return;
    var socket = userdata[uid].socket;
    if (socket == null) return;
    socket.emit('info', {
        msg: msg,
        data: data
    });
}

function lobbiesChangeTrigger() {
    var lobbyData = [];
    for (var i = 0; i < gamedata.length; i++) lobbyData.push({
        name: gamedata[i].name,
        status: gamedata[i].status,
        players: gamedata[i].players.length
    });
    for (var i = 0; i < lobbySubscribers.length; i++) {
        sendClientInfo(lobbySubscribers[i],'lobbyUpdate', lobbyData);
    }
}

function lobbyChangeTrigger(index) {
    for (var i = 0; i < gamedata[index].players.length; i++) {
        var lobbyData = [];
        for (var j = 0; j < gamedata[index].players.length; j++) {
            var player = userdata[gamedata[index].players[j]];
            if (userdata[gamedata[index].players[i]].isHost) {
                lobbyData.push({
                    name: player.name,
                    isHost: player.isHost,
                    isBot: player.isBot,
                    kickRid: player.kickRid
                });
            } else {
                lobbyData.push({
                    name: player.name,
                    isHost: player.isHost,
                    isBot: player.isBot
                });
            }
        }
        sendClientInfo(gamedata[index].players[i], 'singleLobbyUpdate', {
            lobbyData: lobbyData,
            maxRounds: gamedata[index].rounds
        });
    }
}

function roundsChanged(uid, value) {
    if (userdata[uid].isHost) {
        gamedata[userdata[uid].table].rounds = value;
        tableAnnounce(userdata[uid].table, {
            msg: 'maxRoundsChanged',
            data: value
        });
    }
}

function deleteHandlers(uid) {
    for (var i = 0; i < userdata[uid].handlerList.length; i++) {
        var rid = userdata[uid].handlerList[i];
        if (rid in handlers) delete handlers[rid];
    }
    userdata[uid].handlerList = [];
}

function playerDisconnected(uid) {
    if (!(uid in userdata)) return;
    deleteHandlers(uid);
    userdata[uid].isConnected = false;
    if (userdata[uid].status == 1) {
        removePlayer(uid, false);
    }
    if (userdata[uid].status != 2) {
        delete userdata[uid];
    } else {
        var tableId = userdata[uid].table;
        var playerId;
        for (var i = 0; i < gamedata[tableId].players.length; i++) {
            if (gamedata[tableId].players[i] == uid) playerId = i;
        }
        if (!userdata[uid].isBot) gamedata[tableId].infoBox.push({ evt: 'playerLeft', data: playerId });
        userdata[uid].isBot = true;
        if (gamedata[tableId].paused) processInfoBox(tableId, gamedata[tableId].pauseState, () => {});
        if (userdata[uid].gameStatus == 1) {
            userdata[uid].gameStatus = 0;
            userdata[uid].predictedTricks = getBotTricks(userdata[uid].cards, tableId, uid, gamedata[tableId].trump, gamedata[tableId].players.length, playerId, gamedata[tableId].roundOpenedBy);
            confirmTricks(tableId, playerId); 
        } else if (userdata[uid].gameStatus == 2) {
            userdata[uid].gameStatus = 0;
            var n = getBotCard(userdata[uid].cards, tableId, uid, playerId, gamedata[tableId].trickRoundOpenedBy);
            confirmCard(tableId, playerId, gamedata[tableId].trickRoundOpenedBy, n);
        } else if (userdata[uid].gameStatus == 3) {
            userdata[uid].gameStatus = 0;
            gamedata[tableId].trump = determineTrump(uid);
            announceTrump(tableId);
        }
    }
}

function launchGame(tableId) {
    if (gamedata[tableId].players.length < 3) return;
    var playerdata = [];
    var colors = globalData.colors;
    shuffleArray(colors);
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        userdata[gamedata[tableId].players[i]].colors = colors[i];
        playerdata.push({
            name: userdata[gamedata[tableId].players[i]].name,
            isBot: userdata[gamedata[tableId].players[i]].isBot,
            isHost: userdata[gamedata[tableId].players[i]].isHost,
            color: colors[i]
        });
    }
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        var uid = gamedata[tableId].players[i];
        var data = {
            index: i,
            maxRounds: gamedata[tableId].rounds,
            players: playerdata
        }
        sendClientInfo(uid, 'gameIsLaunching', data);
    }
    gamedata[tableId].status = 2;
    gamedata[tableId].round = 0;
    gamedata[tableId].roundOpenedBy = Math.floor(Math.random() * gamedata[tableId].players.length);
    gamedata[tableId].trickRound = 0;
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        var uid = gamedata[tableId].players[i];
        userdata[uid].status = 2;
        deleteHandlers(uid);
        requestToClient(uid, 'chatMsg', { uid: uid }, 'chatToken');
        if (userdata[uid].isHost) {
            requestToClient(uid, 'pauseGame', { table: tableId }, 'pauseToken');
            requestToClient(uid, 'endGame', { table: tableId }, 'endToken');
        }
    }
    lobbiesChangeTrigger();
    wait(2000 + 5000).then(() => {
        tableAnnounce(tableId, { msg: 'startingPlayer', data: gamedata[tableId].roundOpenedBy });
        return wait(5000);
    }).then(() => { startRound(tableId)});
    var timestamp = Date.now();
    gamedata[tableId].inactivityToken = timestamp;
    setTimeout(() => {
        if (gamedata[tableId].inactivityToken == timestamp) {
            tableAnnounce(tableId, { msg: 'gameTooLong', data: null });
            endGame(tableId);
        }
    }, 2 * 24 * 60 * 60 * 1000);
}

function startRound(tableId) {
    globalSUM = 0;
    if (gamedata[tableId].infoBox.length > 0) {
        processInfoBox(tableId, 'roundStart', () => { startRound(tableId) });
        return;
    }
    gamedata[tableId].blacklistedCards = [];
    var cards = [];
    for (var i = 1; i <= 13; i++) {
        cards = cards.concat(['r' + i, 'g' + i, 'b' + i, 'y' + i]);
    }
    cards = cards.concat(['rz', 'rn', 'gz', 'gn', 'bz', 'bn', 'yz', 'yn']);
    cards = shuffleArray(cards);
    for (var i = 0; i <= gamedata[tableId].round; i++) {
        for (j = 0; j < gamedata[tableId].players.length; j++) {
            var uid = gamedata[tableId].players[j];
            userdata[uid].cards['' + i] = cards.shift();
        }
    }
    tableAnnounce(tableId, {
        msg: 'roundStart', data: {
            round: gamedata[tableId].round,
            startPlayer: gamedata[tableId].roundOpenedBy
        }
    });
    wait(5000).then(() => {
        if (cards.length == 0) gamedata[tableId].trump = null;
        else if (cards[0][1] == 'n') gamedata[tableId].trump = null;
        else if (cards[0][1] == 'z') {
            var startPlayer = gamedata[tableId].roundOpenedBy;
            var givingPlayer = (startPlayer - 1 + gamedata[tableId].players.length) % gamedata[tableId].players.length;
            var timer = Date.now() + 30000;
            var uid = gamedata[tableId].players[givingPlayer];
            tableAnnounce(tableId, { msg: 'choosingTrump', data: { player: givingPlayer, timer: timer } });
            if (userdata[uid].isBot) {
                gamedata[tableId].trump = determineTrump(uid);
                wait(5000).then(() => {announceTrump(tableId)});
            } else {
                userdata[uid].gameStatus = 3;
                sendClientInfo(uid, 'yourCards', userdata[uid].cards);
                var rid = requestToClient(gamedata[tableId].players[givingPlayer], 'trumpChoice', { tableId: tableId, uid: uid }, 'chooseTrump');
                wait(30000).then(() => {
                    if (rid in handlers) {
                        delete handlers[rid];
                        userdata[uid].gameStatus = 0;
                        userdata[uid].timeFailCount++;
                        if ((['r', 'g', 'y', 'b']).indexOf(gamedata[tableId].trump) == -1)
                            gamedata[tableId].trump = (['r', 'g', 'y', 'b'])[Math.floor(Math.random() * 4)];
                        if (userdata[uid].timeFailCount == 5) {
                            sendClientInfo(uid, 'timeKick', null);
                            playerDisconnected(uid);
                            replacePlayerWithBot(uid, tableId);
                        }
                        announceTrump(tableId);
                    }
                });
            }
            return;
        }
        else gamedata[tableId].trump = cards[0][0];
        announceTrump(tableId);
    });
}

function determineTrump(uid) {
    var cards = userdata[uid].cards;
    var amounts = {'r': 0, 'g': 0, 'y': 0, 'b': 0};
    for (var key in cards) {
        if (cards[key][1] != 'z' && cards[key][1] != 'n') amounts[cards[key][0]]++;
    }
    var max = 0;
    for (var key in amounts) {
        if (amounts[key] >= max) max = amounts[key];
    }
    var choice = [];
    for (var key in amounts) {
        if (amounts[key] == max) choice.push(key);
    }
    return choice[Math.floor(Math.random() * choice.length)];
} 

function announceTrump(tableId) {
    tableAnnounce(tableId, {
        msg: 'trump',
        data: gamedata[tableId].trump
    });
    wait(5000).then(() => {
    askForTricks(tableId, gamedata[tableId].roundOpenedBy);
    });
}

function askForTricks(tableId, playerId) {
    if (gamedata[tableId].infoBox.length > 0) {
        processInfoBox(tableId, 'trickAskRound', () => { askForTricks(tableId, playerId) });
        return;
    }
    var timer = Date.now() + 60000;
    tableAnnounce(tableId, {
        msg: 'playerChoosingTricks',
        data: { player: playerId, timer: timer }
    });
    var uid = gamedata[tableId].players[playerId];
    userdata[uid].cardsShown = true;
    if (!userdata[uid].isBot) {
        userdata[uid].gameStatus = 1;
        sendClientInfo(uid, 'yourCards', userdata[uid].cards);
        var rid = requestToClient(uid, 'tricksConfirmed', { table: tableId, player: playerId }, 'confirmTricks');
        wait(60000).then(() => {
            if (rid in handlers) {
                delete handlers[rid];
                userdata[uid].gameStatus = 0;
                userdata[uid].timeFailCount++;
                if (userdata[uid].predictedTricks > gamedata[tableId].round + 1) userdata[uid].predictedTricks = gamedata[tableId].round + 1;
                if (userdata[uid].predictedTricks < 0) userdata[uid].predictedTricks = 0;
                tableAnnounce(tableId, {
                    msg: 'playerConfirmedTricks',
                    data: { player: playerId, tricks: userdata[uid].predictedTricks }
                });
                if (userdata[uid].timeFailCount == 5) {
                    sendClientInfo(uid, 'timeKick', null);
                    playerDisconnected(uid);
                    replacePlayerWithBot(uid, tableId);
                }
                wait(5000).then(() => {
                    var playercount = gamedata[tableId].players.length;
                    var nextPlayerId = (playerId + 1) % playercount;
                    if (nextPlayerId != gamedata[tableId].roundOpenedBy) askForTricks(tableId, nextPlayerId);
                    else startTrickRound(tableId, gamedata[tableId].roundOpenedBy);
                });
            }
        });
    } else {
        var botTricks = getBotTricks(userdata[uid].cards, tableId, uid, gamedata[tableId].trump, gamedata[tableId].players.length, playerId, gamedata[tableId].roundOpenedBy);
        userdata[uid].predictedTricks = botTricks;
        wait(5000).then(() => {
            tableAnnounce(tableId, {
                msg: 'playerConfirmedTricks',
                data: { player: playerId, tricks: botTricks }
            });
            return wait(5000);
        }).then(() => {
            var playercount = gamedata[tableId].players.length;
            var nextPlayerId = (playerId + 1) % playercount;
            if (nextPlayerId != gamedata[tableId].roundOpenedBy) askForTricks(tableId, nextPlayerId);
            else startTrickRound(tableId, gamedata[tableId].roundOpenedBy);
        });
    }
}

function confirmTricks(tableId, playerId) {
    var uid = gamedata[tableId].players[playerId];
    userdata[uid].gameStatus = 0;
    if (userdata[uid].predictedTricks > gamedata[tableId].round + 1) userdata[uid].predictedTricks = gamedata[tableId].round + 1;
    if (userdata[uid].predictedTricks < 0) userdata[uid].predictedTricks = 0;
    tableAnnounce(tableId, {
        msg: 'playerConfirmedTricks',
        data: { player: playerId, tricks: userdata[uid].predictedTricks }
    });
    wait(5000).then(() => {
        var playercount = gamedata[tableId].players.length;
        var nextPlayerId = (playerId + 1) % playercount;
        if (nextPlayerId != gamedata[tableId].roundOpenedBy) askForTricks(tableId, nextPlayerId);
        else startTrickRound(tableId, gamedata[tableId].roundOpenedBy);
    });
}

function startTrickRound(tableId, startPlayerId) {
    if (gamedata[tableId].infoBox.length > 0) {
        processInfoBox(tableId, 'trickRound', () => { startTrickRound(tableId, startPlayerId) });
        return;
    }
    gamedata[tableId].trickRoundOpenedBy = startPlayerId;
    if (gamedata[tableId].trickRound > gamedata[tableId].round) {
        endRound(tableId);
        return;
    }
    tableAnnounce(tableId, { 
        msg: 'trickRoundStart', data: {
            round: gamedata[tableId].trickRound,
            startPlayer: startPlayerId
        } 
    });
    wait(5000).then(() => {
        askForCard(tableId, startPlayerId, startPlayerId);
    });
}

function askForCard(tableId, playerId, startPlayerId) {
    var timer = Date.now() + 30000;
    tableAnnounce(tableId, {
        msg: 'playerChoosingCard',
        data: { player: playerId, timer: timer }
    });
    var uid = gamedata[tableId].players[playerId];
    if (!userdata[uid].isBot) {
        userdata[uid].gameStatus = 2;
        var rid = requestToClient(uid, 'cardConfirmed', { table: tableId, player: playerId, startPlayer: startPlayerId }, 'confirmCard');
        wait(30000).then(() => {
            if (rid in handlers) {
                delete handlers[rid];
                userdata[uid].gameStatus = 0;
                userdata[uid].timeFailCount++; 
                var selectedCard = userdata[uid].selectedCardIndex;
                if (!canPickCard(tableId, userdata[uid].cards, selectedCard)) selectedCard = Object.keys(userdata[uid].cards)[0];
                var cardName = userdata[uid].cards[selectedCard];
                gamedata[tableId].cardsOnTable.push(cardName);
                gamedata[tableId].blacklistedCards.push(cardName);
                delete userdata[uid].cards[selectedCard];
                tableAnnounce(tableId, {
                    msg: 'playerConfirmedCard',
                    data: { player: playerId, cardIndex: selectedCard, card: cardName }
                });
                if (userdata[uid].timeFailCount == 5) {
                    sendClientInfo(uid, 'timeKick', null);
                    playerDisconnected(uid);
                    replacePlayerWithBot(uid, tableId);
                }
                wait(5000).then(() => {
                    var playercount = gamedata[tableId].players.length;
                    var nextPlayerId = (playerId + 1) % playercount;
                    if (nextPlayerId != startPlayerId) askForCard(tableId, nextPlayerId, startPlayerId);
                    else determineTrickWinner(tableId, startPlayerId);
                });
            }
        }); 
    } else {
        var botCard = getBotCard(userdata[uid].cards, tableId, uid, playerId, startPlayerId);
        userdata[uid].selectedCardIndex = botCard;
        wait(5000).then(() => {
            var cardName = userdata[uid].cards[botCard];
            gamedata[tableId].cardsOnTable.push(cardName);
            gamedata[tableId].blacklistedCards.push(cardName);
            delete userdata[uid].cards[botCard];
            tableAnnounce(tableId, {
                msg: 'playerConfirmedCard',
                data: { player: playerId, cardIndex: botCard, card: cardName }
            });
            return wait(5000);
        }).then(() => {
            var playercount = gamedata[tableId].players.length;
            var nextPlayerId = (playerId + 1) % playercount;
            if (nextPlayerId != startPlayerId) askForCard(tableId, nextPlayerId, startPlayerId);
            else determineTrickWinner(tableId, startPlayerId);
        });
    } 
}

function confirmCard(tableId, playerId, startPlayerId, selectedCard) {
    var uid = gamedata[tableId].players[playerId];
    if (!canPickCard(tableId, userdata[uid].cards, selectedCard)) selectedCard = Object.keys(userdata[uid].cards)[0];
    var cardName = userdata[uid].cards[selectedCard];
    userdata[uid].gameStatus = 0;
    gamedata[tableId].cardsOnTable.push(cardName);
    gamedata[tableId].blacklistedCards.push(cardName);
    delete userdata[uid].cards[selectedCard];
    tableAnnounce(tableId, {
        msg: 'playerConfirmedCard',
        data: { player: playerId, cardIndex: selectedCard, card: cardName }
    });
    wait(5000).then(() => {
        var playercount = gamedata[tableId].players.length;
        var nextPlayerId = (playerId + 1) % playercount;
        if (nextPlayerId != startPlayerId) askForCard(tableId, nextPlayerId, startPlayerId);
        else determineTrickWinner(tableId, startPlayerId);
    });
}

function determineTrickWinner(tableId, startPlayerId) {
    var winningCard = getWinningCardIndex(gamedata[tableId].cardsOnTable, gamedata[tableId].trump);
    var trickWinner = (startPlayerId + winningCard) % gamedata[tableId].players.length;
    var uid = gamedata[tableId].players[trickWinner];
    userdata[uid].tricks++;
    tableAnnounce(tableId, {
        msg: 'trickWinnerDetermined',
        data: trickWinner
    });
    wait(5000).then(() => {
        gamedata[tableId].cardsOnTable = [];
        gamedata[tableId].trickRound++;
        for (var i = 0; i < gamedata[tableId].players.length; i++) {
            var uid = gamedata[tableId].players[i];
            var usercards = userdata[uid].cards;
            userdata[uid].selectedCardIndex = Object.keys(usercards)[0];
        }
        startTrickRound(tableId, trickWinner);
    });
}

function getWinningCardIndex(cardsOnTable, trump) {
    var cards = [];
    for (var i = 0; i < cardsOnTable.length; i++) cards.push([
        cardsOnTable[i][0],
        cardsOnTable[i].slice(1)
    ]);
    for (var i = 0; i < cards.length; i++) {
        if (cards[i][1] != 'n' && cards[i][1] != 'z') cards[i][1] = parseInt(cards[i][1]);
    }
    var startColor = cards[0][0];
    var winningCard = 0;
    var trumped = startColor == trump;
    if (cards[0][1] == 'n') trumped = false;
    for (var i = 1; i < cards.length; i++) {
        if (cards[winningCard][1] == 'n' && cards[i][1] != 'n') {
            winningCard = i;
            startColor = cards[i][0];
        } else if (cards[winningCard][1] != 'z' && cards[i][1] != 'n') {
            if (cards[i][1] == 'z') winningCard = i;
            else if (cards[i][0] == startColor && ((!trumped) || startColor == trump) && cards[i][1] > cards[winningCard][1]) winningCard = i;
            else if (cards[i][0] == trump && (cards[i][1] > cards[winningCard][1] || (!trumped))) {
                winningCard = i;
                trumped = true;
            }
        }
    }
    return winningCard;
}

function endRound(tableId) {
    var credits = [];
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        var uid = gamedata[tableId].players[i];
        userdata[uid].cardsShown = false;
        if (userdata[uid].tricks == userdata[uid].predictedTricks) credits.push(userdata[uid].credits += 20 + 10 * userdata[uid].tricks);
        else credits.push(userdata[uid].credits += (-10) * Math.abs(userdata[uid].tricks - userdata[uid].predictedTricks));
    }
    tableAnnounce(tableId, {
        msg: 'roundEnd',
        data: credits
    });
    wait(4000 * gamedata[tableId].players.length).then(() => { 
        gamedata[tableId].round++;
        gamedata[tableId].roundOpenedBy = (gamedata[tableId].roundOpenedBy + 1) % gamedata[tableId].players.length;
        gamedata[tableId].trickRound = 0;
        for (var i = 0; i < gamedata[tableId].players.length; i++) {
            var uid = gamedata[tableId].players[i];
            userdata[uid].tricks = 0;
            userdata[uid].predictedTricks = 0;
        }
        if (gamedata[tableId].round < gamedata[tableId].rounds) {
            startRound(tableId);
        } else {
            endGame(tableId);
        }
    });
}

function endGame(tableId) {
    tableAnnounce(tableId, { msg: 'endGame', data: null });
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        deleteHandlers(gamedata[tableId].players[i]);
        delete userdata[gamedata[tableId].players[i]];
    }
    gamedata[tableId].status = 0;
    gamedata[tableId].paused = false;
    gamedata[tableId].pauseState = '';
    gamedata[tableId].rounds = 20;
    gamedata[tableId].round = 0;
    gamedata[tableId].players = [];
    gamedata[tableId].bannedPlayers = [];
    gamedata[tableId].trump = null;
    gamedata[tableId].cardsOnTable = [];
    gamedata[tableId].roundOpenedBy = 0;
    gamedata[tableId].trickRound = 0;
    gamedata[tableId].trickRoundOpenedBy = 0;
    gamedata[tableId].blacklistedCards = [];
    gamedata[tableId].infoBox = [];
    gamedata[tableId].inactivityToken = 0;
    lobbiesChangeTrigger();
} 

function processInfoBox(tableId, status, callback) {
    var evt = gamedata[tableId].infoBox[0].evt;
    var data = gamedata[tableId].infoBox[0].data;
    gamedata[tableId].pauseState = status;
    switch (evt) {
        case 'gamePaused':
            pauseGame(tableId, callback);
            break;
        case 'gameResumed':
            callback = gamedata[tableId].resumeFunction;
            resumeGame(tableId);
            break;
        case 'playerLeft':
            tableAnnounce(tableId, {
                msg: 'playerLeft',
                data: data
            });
            var uid = gamedata[tableId].players[data];
            if (userdata[uid].isHost) {
                for (var i = 0; i < gamedata[tableId].players.length; i++) {
                    var id = gamedata[tableId].players[i];
                    if (!userdata[id].isBot) {
                        userdata[uid].isHost = false;
                        userdata[id].isHost = true;
                        sendClientInfo(id, 'youAreHost', null);
                        requestToClient(id, 'pauseGame', { table: tableId }, 'pauseToken');
                        requestToClient(id, 'endGame', { table: tableId }, 'endToken');
                        tableAnnounce(tableId, { msg: 'newHost', data: i });
                        break;
                    }
                }
            }
            if (userdata[uid].isHost) gamedata[tableId].infoBox.push({ evt: 'gamePaused', data: null });
            break;
        case 'playerRejoined':
            letPlayersRejoin(tableId, data, status);
            break;
    }
    wait(5000).then(() => {
        gamedata[tableId].infoBox.shift();
        if (!gamedata[tableId].paused) callback();
        else if (gamedata[tableId].infoBox.length > 0) processInfoBox(tableId, status, callback);
        else tableAnnounce(tableId, { msg: 'gamePaused', data: null });
    });
}

function pauseGame(tableId, callback) {
    gamedata[tableId].paused = true;
    gamedata[tableId].resumeFunction = callback;
    var host = '';
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        if (userdata[gamedata[tableId].players[i]].isHost) host = gamedata[tableId].players[i];
    }
    requestToClient(host, 'resumeGame', { table: tableId }, 'pauseToken');
    tableAnnounce(tableId, { msg: 'gamePaused', data: null });
}

function resumeGame(tableId) {
    var host = '';
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        if (userdata[gamedata[tableId].players[i]].isHost) host = gamedata[tableId].players[i];
    }
    gamedata[tableId].paused = false;
    tableAnnounce(tableId, { msg: 'gameResumed', data: null });
    wait(5000).then(() => { requestToClient(host, 'pauseGame', { table: tableId }, 'pauseToken') });
}

function letPlayersRejoin(tableId, playerId, status) {
    var uid = gamedata[tableId].players[playerId];
    var index = 0;
    var playerData = [];
    if (userdata[uid].isHost) {
        sendClientInfo(uid, 'youAreHost', null);
        if (!gamedata[tableId].paused) requestToClient(uid, 'pauseGame', { table: tableId }, 'pauseToken');
        else requestToClient(uid, 'resumeGame', { table: tableId }, 'pauseToken');
        requestToClient(uid, 'endGame', { table: tableId }, 'endToken');
    }
    for (var i = 0; i < gamedata[tableId].players.length; i++) {
        if (gamedata[tableId].players[i] == uid) index = i;
        playerId = gamedata[tableId].players[i];
        playerData.push({
            credits: userdata[playerId].credits,
            color: userdata[playerId].colors,
            isBot: userdata[playerId].isBot,
            isHost: userdata[playerId].isHost,
            name: userdata[playerId].name, 
            tricks: userdata[playerId].tricks,
            predictedTricks: userdata[playerId].predictedTricks
        });
    }
    var cards = {};
    if (userdata[uid].cardsShown) {
        for (var key in userdata[uid].cards) cards[key] = userdata[uid].cards[key];
    } else {
        for (var key in userdata[uid].cards) cards[key] = '';
    }
    var rejoinData = {
        round: gamedata[tableId].round,
        rounds: gamedata[tableId].rounds,
        playerIndex: index,
        trump: gamedata[tableId].trump,
        selectedTricks: userdata[uid].predictedTricks,
        cards: cards,
        cardsShown: userdata[uid].cardsShown,
        cardsOnTable: gamedata[tableId].cardsOnTable,
        roundStartedBy: gamedata[tableId].roundOpenedBy,
        players: playerData,
        status: status
    };
    tableAnnounce(tableId, { msg: 'playerRejoining', data: index });
    userdata[uid].isBot = false;
    sendClientInfo(uid, 'rejoinConfirmed', rejoinData);
    requestToClient(uid, 'chatMsg', { uid: uid }, 'chatToken');
}

function canPickCard(tableId, myCards, selectedCardIndex) {
    var startColor = null;
    for (var i = 0; i < gamedata[tableId].cardsOnTable.length; i++) {
        if (gamedata[tableId].cardsOnTable[i][1] == 'z') break;
        if (gamedata[tableId].cardsOnTable[i][1] == 'n') continue;
        startColor = gamedata[tableId].cardsOnTable[i][0];
        break;
    }
    hasToServe = false;
    for (key in myCards) {
        if (myCards[key][0] == startColor && myCards[key][1] != 'z' && myCards[key][1] != 'n') hasToServe = true;
    }
    var card = myCards[selectedCardIndex];
    if (card == undefined) return false;
    if (hasToServe) {
        if (startColor != null && card[0] != startColor && card[1] != 'z' && card[1] != 'n') return false;
        return true;
    } else return true;
}

function shuffleArray(array) {
    // Reference: https://stackoverflow.com/a/2450976
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function wait(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    }).catch(e => {throw e});
}

function getBotTricks(myCards, tableId, uid) {
    var cards = [];
    for (var key in myCards) cards.push(myCards[key]);
    var sum = repCards(cards, tableId, gamedata[tableId].players[gamedata[tableId].roundOpenedBy] == uid ? 1 : -1).sum;
    return Math.round(sum);
}

function repCards(myCards, tableId, roundDist) {
    var cards = [];
    for (var i = 1; i <= 13; i++) cards = cards.concat(['r' + i, 'g' + i, 'b' + i, 'y' + i]);
    cards = cards.concat(['rz', 'rn', 'gz', 'gn', 'bz', 'bn', 'yz', 'yn']);
    for (var i = 0; i < myCards.length; i++) cards.splice(cards.indexOf(myCards[i]), 1);
    var result = {};
    result.sum = 0;
    result.details = {};
    for (var i = 0; i < myCards.length; i++) {
        var cardValue = repCard(myCards[i], cards, tableId, roundDist);
        result.sum += cardValue;
        result.details[myCards[i]] = cardValue;
    }
    return result;
}

function repCard(card, availableCards, tableId, roundDist) {
    try{
    var playerCount = gamedata[tableId].players.length;
    if (card[1] == 'n') return 0;
    if (card[1] == 'z') return 1;

    var trump = gamedata[tableId].trump;
    var myColor = card[0];
    var myNumber = parseInt(card.substr(1));
    var betterCards = 0;
    var neutralCards = 0;
    for (var i = 0; i < availableCards.length; i++) {
        if (availableCards[i][1] == 'z') {
            betterCards++;
            continue;
        }
        if (availableCards[i][1] == 'n') continue;
        var color = availableCards[i][0];
        var number = parseInt(availableCards[i].substr(1));
        var hasTrump = trump == color;
        if (myColor == color) {
            if (number > myNumber) betterCards++;
        } else {
            if (hasTrump) betterCards++;
            else neutralCards++;
        }
    }
    var playerCount = gamedata[tableId].players.length;
    var playerPercent = (playerCount - 1) / playerCount;
    var rounds = gamedata[tableId].round + 1;
    var roundPercent;
    if (roundDist == 0) roundPercent = playerPercent;
    if (roundDist == 1) roundPercent = ((rounds - 1) * playerPercent) / rounds;
    if (roundDist == -1) roundPercent = (1 + playerPercent * (rounds - 1)) / rounds;
    var neutralValue = neutralCards * roundPercent;

    betterCards += neutralValue;
    return 1 - (betterCards / availableCards.length);
    } catch(e) {throw e}
}

function getBotCard(myCardsObject, tableId, uid) {
    var availableCards = [];
    for (var i = 1; i <= 13; i++) availableCards = availableCards.concat(['r' + i, 'g' + i, 'b' + i, 'y' + i]);
    availableCards = availableCards.concat(['rz', 'rn', 'gz', 'gn', 'bz', 'bn', 'yz', 'yn']);
    for (var key in myCardsObject) {
        var index = availableCards.indexOf(myCardsObject[key]);
        availableCards.splice(index, 1);
    }
    for (var i = 0; i < gamedata[tableId].blacklistedCards; i++) {
        var index = availableCards.indexOf(gamedata[tableId].blacklistedCards[i]);
        availableCards.splice(index, 1);
    }
    var myCards = [];
    for (var key in myCardsObject) myCards.push(myCardsObject[key]);
    if (uid != gamedata[tableId].players[gamedata[tableId].trickRoundOpenedBy]) {
        var cardDifferences = [];
        var anyWins = false;
        for (var key in myCardsObject) {
            var winner = getWinningCardIndex(gamedata[tableId].cardsOnTable.concat(myCardsObject[key]), gamedata[tableId].trump);
            var wins = winner == gamedata[tableId].cardsOnTable.length;
            if (canPickCard(tableId, myCardsObject, key)) {
                cardDifferences.push({
                    key: key,
                    wins: wins
                });
                if (wins) anyWins = true;
            }
        }
        for (var i = 0; i < cardDifferences.length; i++) {
            var key = cardDifferences[i].key;
            var offset = cardDifferences[i].winns ? 1 : 0;
            var roundDist = offset;
            if (!anyWins) roundDist = -1;
            var newCards = [];
            for (var j = 0; j < myCards.length; j++) {
                if (myCards[j] != myCardsObject[key]) newCards.push(myCards[j]);
            }
            var newTrickGuess = repCards(newCards, tableId, roundDist).sum;
            cardDifferences[i].diff = Math.abs(userdata[uid].tricks - offset - newTrickGuess);
        }
        cardDifferences = cardDifferences.sort((a, b) => {
            if (a.diff < b.diff) return -1;
            if (a.diff > b.diff) return 1;
            if (!a.winns) return -1;
            return 0;
        });
        return cardDifferences[0].key;
    } else {
        var cardRanking = [];
        for (var key in myCardsObject) {
            cardRanking.push({
                key: key,
                wiz: myCardsObject[key][1] == 'z',
                narr: myCardsObject[key][1] == 'n',
                color: myCardsObject[key][0],
                number: parseInt(myCardsObject[key].substr(1)),
                high: parseInt(myCardsObject[key].substr(1)) > 7,
                trump: myCardsObject[key][0] == gamedata[tableId].trump,
                pickable: canPickCard(tableId, myCardsObject, key)
            });
        }
        var cardScore = repCards(myCards, tableId, 1);
        if (userdata[uid].tricks - cardScore > 0.5) {
            cardRanking = cardRanking.sort((a, b) => {
                if (!a.pickable) return 1;
                if (!b.pickable) return -1;
                if (a.wiz) return -1;
                if (b.wiz) return 1;
                if (a.trump && b.trump && a.high && b.high) {
                    if (a.number > b.number) return -1;
                    if (a.number < b.number) return 1;
                }
                if (a.trump && a.high) return -1;
                if (b.trump && b.high) return 1;
                if (a.number > b.number) return -1;
                if (a.number < b.number) return 1;
                if (a.narr) return 1;
                if (b.narr) return -1;
                return 0;
            });
        } else {
            cardRanking = cardRanking.sort((a, b) => {
                if (!a.pickable) return 1;
                if (!b.pickable) return -1;
                if (a.wiz) return 1;
                if (b.wiz) return -1;
                if (a.narr) return 1;
                if (b.narr) return -1;
                if ((!a.trump) && (!b.trump)) {
                    if (a.number > b.number) return 1;
                    if (a.number < b.number) return -1;
                }
                if (!a.trump) return -1;
                if (!b.trump) return 1;
                if (a.number > b.number) return 1;
                if (a.number < b.number) return -1;
                return 0;
            });
        }
        return cardRanking[0].key;
    }
}