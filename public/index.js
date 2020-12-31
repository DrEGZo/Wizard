window.onload = start;
var mainapp;
var startapp;
var endapp;
var infoapp;
var socket;

function main() {
    /* console.log('Testing socket.io...');
    console.log('Pinging server...');
    console.log('Client: Ping');
    socket.emit('serverping', 'Ping');
    socket.on('serverping', (msg) => {
        console.log('Server: ' + msg);
    });
    socket.on('clientping', () => {
        socket.emit('clientping', 'Pong');
    }); */

    var preloadImages = [];
    var cards = [];
    for (var i = 1; i <= 13; i++) {
        cards = cards.concat(['r' + i, 'g' + i, 'b' + i, 'y' + i]);
    }
    cards = cards.concat(['rz', 'rn', 'gz', 'gn', 'bz', 'bn', 'yz', 'yn', 'back', 'backflipped']);
    for (var i = 0; i < 60; i++) {
        preloadImages[i] = new Image();
        preloadImages[i].src = 'cards/' + cards[i] + '.png';
    }

    
    mainapp = new Vue({
        el: '#mainpanel',
        data: {
            title: '',
            isTitleChanging: false,
            subtitle: '',
            isSubtitleChanging: false,
            mainPanelShown: false,
            mainPanelVisible: false,
            round: 5,
            rounds: 20,
            playerIndex: 0,
            gameStatus: 0,
            playerOnTurn: null,
            trump: undefined,
            trumpToken: '',
            chosenTrumpColor: '',
            selectedTricks: 0,
            trickConfirmToken: '',
            cards: {},
            cardsOnTable: [],
            cardsOnTableShown: false,
            cardConfirmToken: '',
            selectedCard: null,
            cardsVisible: false,
            cardsShown: false,
            cardsUnfolded: false,
            timer: '1s',
            timerActive: false,
            timerVisible: false,
            timerToken: 0,
            players: [],
            playerLabels: [],
            chat: [],
            chatToken: '',
            scrollChatDown: false,
            pauseToken: '',
            endToken: '',
            infoBox: [],
            pausing: false,
            ending: false,
            isHost: false
        },
        methods: {
            centerLabelName: function (n) {
                var offset = this.round % this.players.length;
                var playerIndex = (n + offset) % this.players.length;
                return this.players[playerIndex].name;
            },
            getCardImage: function (key) {
                var shadow = '0 0 ' + (window.outerWidth > 992 ? '20' : '10') + 'px 1px';
                if (this.gameStatus == 2 && this.canPick(key)) shadow += (this.getWinningCardIndex(this.cardsOnTable.concat([this.cards[key]])) == this.cardsOnTable.length) ? ' #0fbb0f' : ' #f00';
                else shadow += ' #000';
                if (this.cards[key]) return { backgroundImage: 'url("cards/' + this.cards[key] + '.png")', boxShadow: shadow };
                return { backgroundImage: 'url("cards/backflipped.png")', boxShadow: shadow };
            },
            transmitTrickCount: function () {
                socket.emit('info', {
                    msg: 'trickCount',
                    data: { uid: parseCookies().uid, value: this.selectedTricks }
                });
            },
            transmitCardIndex: function (key) {
                socket.emit('info', {
                    msg: 'cardIndex',
                    data: { uid: parseCookies().uid, value: key }
                });
            },
            transmitTrump: function (color) {
                socket.emit('info', {
                    msg: 'trump',
                    data: { uid: parseCookies().uid, value: color }
                });
                this.chosenTrumpColor = color;
            },
            confirmTrumpTricks: function () {
                if (this.trumpToken == '') respondToServer(this.trickConfirmToken, null);
                else {
                    respondToServer(this.trumpToken, null);
                    this.cardsShown = false;
                }
            },
            confirmCard: function (key) {
                if (this.canPick(key)) respondToServer(this.cardConfirmToken, key);
            },
            playerName: function (index) {
                var name = this.players[index].name;
                if (this.players[index].isHost) name += ' (Host)';
                if (this.players[index].isBot) name += ' (Bot)';
                return name;
            },
            canPick: function (key) {
                var card = this.cards[key];
                if (this.hasToServe) {
                    if (this.startColor != null && card[0] != this.startColor && card[1] != 'z' && card[1] != 'n') return false;
                    return true;
                } else return true;
            },
            sendChatMessage: function (evt) {
                if (evt.target.value != '') respondToServer(mainapp.chatToken, evt.target.value);
                evt.target.value = '';
            },
            pauseGame: function (evt) {
                this.pausing = true;
                respondToServer(mainapp.pauseToken, null);
                if (evt.target.innerHTML == 'Spiel pausieren') evt.target.innerHTML = 'Pausiere...';
            },
            endGame: function (evt) {
                this.ending = true;
                respondToServer(mainapp.endToken, null);
                if (evt.target.innerHTML == 'Spiel auswerten') evt.target.innerHTML = 'Beende...';
                this.rounds = this.round + 1;
            },
            leaveGame: function () {
                mainapp.mainPanelVisible = false;
                wait(1000).then(() => { window.location.reload() });
            },
            getWinningCardIndex: function (cardsOnTable) {
                if (cardsOnTable.length == 0) return;
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
                var trumped = startColor == this.trump;
                if (cards[0][1] == 'n') trumped = false;
                for (var i = 1; i < cards.length; i++) {
                    if (cards[winningCard][1] == 'n' && cards[i][1] != 'n') {
                        winningCard = i;
                        startColor = cards[i][0];
                        if (startColor == this.trump) trumped = true;
                    } else if (cards[winningCard][1] != 'z' && cards[i][1] != 'n') {
                        if (cards[i][1] == 'z') winningCard = i;
                        else if (cards[i][0] == startColor && ((!trumped) || startColor == this.trump) && cards[i][1] > cards[winningCard][1]) winningCard = i;
                        else if (cards[i][0] == this.trump && (cards[i][1] > cards[winningCard][1] || (!trumped))) {
                            winningCard = i;
                            trumped = true;
                        }
                    }
                }
                return winningCard;
            }
        },
        computed: {
            isMainPanelVisible: function () {
                var notshown = { opacity: '0' };
                var shown = { opacity: '1' };
                if (this.mainPanelVisible) return shown;
                else return notshown;
            },
            trumpLabel: function () {
                if (this.trump === null) return 'kein Trumpf';
                if (this.trump === undefined) return '-';
                var map = { r: 'Rot', b: 'Blau', g: 'Grün', y: 'Gelb' };
                return map[this.trump];
            },
            getCardRotation: function () {
                if (this.cardsShown) return { transform: 'rotateY(0deg)' };
                return { transform: 'rotateY(180deg)' };
            },
            tableCards: function () {
                var cards = [];
                for (var i = 0; i < this.players.length; i++) {
                    if (this.cardsOnTable[i] == undefined) cards.push('back');
                    else cards.push(this.cardsOnTable[i]);
                }
                return cards;
            },
            startColor: function () {
                var startColor = null;
                for (var i = 0; i < this.cardsOnTable.length; i++) {
                    if (this.cardsOnTable[i][1] == 'z') break;
                    if (this.cardsOnTable[i][1] == 'n') continue;
                    startColor = this.cardsOnTable[i][0];
                    break;
                }
                return startColor;
            },
            hasToServe: function () {
                hasToServe = false;
                for (key in this.cards) {
                    if (this.cards[key] == undefined) return false;
                    if (this.cards[key][0] == this.startColor && this.cards[key][1] != 'z' && this.cards[key][1] != 'n') hasToServe = true;
                }
                return hasToServe;
            }
        },
        updated: function () {
            if (this.scrollChatDown) {
                this.scrollChatDown = false;
                var chat = document.getElementById('chat-messages');
                chat.scrollTop = chat.scrollHeight - chat.offsetHeight;
            }
        }
    });
    submain();
}

function handleRequest(request) {
    switch (request.msg) {
        case 'sendUserCookie':
            sendUserCookie(request.rid);
            break;
        case 'rejoinToken':
            startapp.rejoinToken = request.rid;
            startapp.canRejoin = true;
            startapp.startPanelVisible = true;
            break;
        case 'sendNickname':
            startapp.nicknameToken = request.rid;
            startapp.startPanelVisible = true;
            break;
        case 'selectLobby':
            startapp.selectedLobbyToken = request.rid;
            break;
        case 'leaveLobby':
            startapp.leaveLobbyToken = request.rid;
            break;
        case 'addBotTrigger':
            startapp.botAddingToken = request.rid;
            break;
        case 'startGameToken':
            startapp.gameLaunchToken = request.rid;
            break;
        case 'chooseTrump':
            mainapp.trumpToken = request.rid;
            mainapp.cardsShown = true;
            mainapp.chosenTrumpColor = '';
            break;
        case 'confirmTricks':
            mainapp.trickConfirmToken = request.rid;
            mainapp.gameStatus = 1;
            break;
        case 'confirmCard':
            mainapp.cardConfirmToken = request.rid;
            mainapp.gameStatus = 2;
            break;
        case 'chatToken':
            mainapp.chatToken = request.rid;
            break;
        case 'pauseToken':
            mainapp.pauseToken = request.rid;
            break;
        case 'endToken':
            mainapp.endToken = request.rid;
            break;
    }
}

function handleInfo(info) {
    switch (info.msg) {
        case 'multipleConnections':
            alert('Du hast das Spiel bereits in einem anderen Tab geöffnet. Kehre dahin zurück.');
            break;
        case 'rejoinData':
            startapp.rejoinData = info.data;
            break;
        case 'bannedInLobbies':
            startapp.bannedInLobbies = info.data;
            break;
        case 'lobbyUpdate':
            startapp.lobbydata = info.data;
            break;
        case 'singleLobbyUpdate':
            startapp.lobbyPlayers = info.data.lobbyData;
            startapp.maxRounds = info.data.maxRounds;
            if (startapp.isHost) startapp.selectedMaxRounds = info.data.maxRounds;
            break;
        case 'maxRoundsChanged':
            startapp.maxRounds = info.data;
            break;
        case 'youHaveBeenKicked':
            kickedFromLobby(info);
            break;
        case 'banExpired':
            startapp.bannedInLobbies.splice(info.data, 1, false);
            break;
        case 'youAreHost':
            startapp.isHost = true;
            mainapp.isHost = true;
            break;
        case 'gameIsLaunching':
            launchGame(info.data);
            break;
        case 'startingPlayer':
            changeTitles({
                title: 'Startspieler festgelegt',
                subtitle: 'Der erste Zug geht an ' + mainapp.players[info.data].name
            });
            break;
        case 'roundStart':
            mainapp.trump = undefined;
            mainapp.selectedTricks = 0;
            mainapp.selectedCard = false;
            var names = [];
            for (var i = 0; i < mainapp.players.length; i++) names.push(mainapp.players[i].name);
            while (names[0] != mainapp.players[info.data.startPlayer].name) names.push(names.shift());
            mainapp.playerLabels = names;
            for (var i = 0; i < mainapp.players.length; i++) {
                mainapp.players[i].predictedTricks = '-';
                mainapp.players[i].tricks = '-';
            }
            mainapp.round = info.data.round;
            for (var i = 0; i <= mainapp.round; i++) mainapp.cards[i + ''] = '';
            changeTitles({ title: 'Rundenbeginn', subtitle: 'Runde ' + (info.data.round + 1) + ' von ' + mainapp.rounds });
            mainapp.cardsVisible = true;
            wait(500).then(() => { mainapp.cardsUnfolded = true; });
            break;
        case 'choosingTrump':
            if (info.data.player == mainapp.playerIndex) changeTitles({
                title: 'Zauberer liegt auf',
                subtitle: 'Du darfst dir eine Trumpffarbe aussuchen.'
            });
            else changeTitles({
                title: 'Zauberer liegt auf',
                subtitle: mainapp.players[info.data.player].name + ' darf eine Trumpffarbe wählen.'
            });
            activateTimer(info.data.timer);
            break;
        case 'trump':
            cancelTimer();
            if (mainapp.cardsShown) mainapp.cardsShown = false;
            if (mainapp.trumpToken != '') mainapp.trumpToken = '';
            mainapp.trump = info.data;
            var map = { r: 'Rot', b: 'Blau', g: 'Grün', y: 'Gelb' };
            if (mainapp.trump) changeTitles({ title: map[mainapp.trump] + ' ist Trumpf' });
            else changeTitles({ title: 'Kein Trumpf in dieser Runde' });
            break;
        case 'playerChoosingTricks':
            mainapp.playerOnTurn = info.data.player;
            if (info.data.player == mainapp.playerIndex) changeTitles({
                title: 'Wieviele Stiche bekommst du?', 
                subtitle: 'Stelle den Slider auf deine Schätzung und klicke auf OK.'
            });
            else changeTitles({
                title: mainapp.players[info.data.player].name + ' gibt seinen Tipp ab.',
                subtitle: 'Bitte warte solange.'
            });
            activateTimer(info.data.timer);
            break;
        case 'yourCards':
            mainapp.cards = info.data;
            mainapp.cardsShown = true;
            break;
        case 'playerConfirmedTricks':
            if (info.data.player == mainapp.playerIndex) {
                mainapp.gameStatus = 0;
                changeTitles({
                    title: 'Tipp abgegeben',
                    subtitle: 'Deine Schätzung beträgt ' + info.data.tricks + ' Stich(e).'
                });
            } else changeTitles({
                title: 'Tipp wurde abgegeben',
                subtitle: mainapp.players[info.data.player].name + 's Schätzung beträgt ' + info.data.tricks + ' Stich(e).'
            });
            cancelTimer();
            mainapp.players[info.data.player].predictedTricks = info.data.tricks;
            break;
        case 'trickRoundStart':
            mainapp.playerOnTurn = null;
            mainapp.cardsOnTable = [];
            mainapp.cardsOnTableShown = true;
            for (var i = 0; i < mainapp.players.length; i++) {
                if (mainapp.players[i].tricks == '-') mainapp.players[i].tricks = 0;
            }
            if (info.data.startPlayer == mainapp.playerIndex) changeTitles({
                title: 'Stich ' + (info.data.round + 1) + ' von ' + (mainapp.round + 1),
                subtitle: 'Die Stichrunde wird von dir eröffnet.'
            });
            else changeTitles({
                title: 'Stich ' + (info.data.round + 1) + ' von ' + (mainapp.round + 1),
                subtitle: 'Die Stichrunde wird von ' + mainapp.players[info.data.startPlayer].name + ' eröffnet.'
            });
            var names = [];
            for (var i = 0; i < mainapp.players.length; i++) names.push(mainapp.players[i].name);
            while (names[0] != mainapp.players[info.data.startPlayer].name) names.push(names.shift());
            mainapp.playerLabels = names;
            break;
        case 'playerChoosingCard':
            mainapp.playerOnTurn = info.data.player;
            if (info.data.player == mainapp.playerIndex) changeTitles({
                title: 'Wähle eine Karte aus!',
                subtitle: 'Bestätige deine Auswahl durch Klick auf die Karte.'
            });
            else changeTitles({
                title: mainapp.players[info.data.player].name + ' wählt eine Karte.',
                subtitle: 'Bitte warte solange.'
            });
            activateTimer(info.data.timer);
            break;
        case 'playerConfirmedCard':
            if (info.data.player == mainapp.playerIndex) {
                mainapp.selectedCard = info.data.card;
                wait(200).then(() => { delete mainapp.cards[info.data.cardIndex] });
                mainapp.gameStatus = 0;
                changeTitles({
                    title: 'Karte gespielt',
                    subtitle: 'Du hast ' + translateCardName(info.data.card) + ' gespielt.'
                });
            } else changeTitles({
                title: 'Karte wurde gespielt',
                subtitle: mainapp.players[info.data.player].name + ' spielt ' + translateCardName(info.data.card) + '.'
            });
            wait(500).then(() => { mainapp.cardsOnTable.push(info.data.card) });
            cancelTimer();
            break;
        case 'timeKick':
            alert("Du hast 5 mal das Zeitlimit missachtet und wurdest aus dem Spiel ausgeschlossen");
            window.location.reload();
            break;
        case 'trickWinnerDetermined':
            mainapp.playerOnTurn = null;
            mainapp.players[info.data].tricks++;
            mainapp.cardsOnTableShown = false;
            if (info.data == mainapp.playerIndex) {
                changeTitles({
                    title: 'Stichrunde beendet',
                    subtitle: 'Du hast den Stich gewonnen.'
                });
            } else changeTitles({
                title: 'Stichrunde beendet',
                subtitle: mainapp.players[info.data].name + ' hat den Stich gewonnen.'
            });
            break;
        case 'roundEnd':
            for (var i = 0; i < mainapp.players.length; i++) ((index) => wait(index * 4000).then(() => {
                var subtitle = parsePlayerPoints(index, info.data[index] - mainapp.players[index].credits);
                changeTitles({
                    title: 'Runde beendet',
                    subtitle: subtitle
                });
                return wait(1000);
            }).then(() => {
                TweenLite.to(mainapp.players[index], 2, { credits: info.data[index] });
            }))(i);
            mainapp.cardsShown = false;
            mainapp.cardsUnfolded = false;
            mainapp.cardsVisible = false;
            break;
        case 'newChatMsg':
            var chat = document.getElementById('chat-messages');
            mainapp.scrollChatDown = chat.scrollTop == chat.scrollHeight - chat.offsetHeight;
            mainapp.chat.push({ author: info.data.name, message: info.data.text });
            break;
        case 'gamePaused':
            mainapp.pausing = false;
            changeTitles({
                title: 'Spiel pausiert',
                subtitle: 'Der Host hat das Spiel pausiert.'
            });
            document.getElementById('control-pause-game').innerHTML = 'Fortsetzen';
            break;
        case 'gameResumed':
            mainapp.pausing = true;
            changeTitles({
                title: 'Spiel fortgesetzt',
                subtitle: 'Es geht da weiter, wo ihr aufgehört habt!'
            });
            document.getElementById('control-pause-game').innerHTML = 'Setze fort...';
            wait(5000).then(() => {
                document.getElementById('control-pause-game').innerHTML = 'Spiel pausieren';
                mainapp.pausing = false;
            });
            break;
        case 'playerLeft':
            changeTitles({
                title: 'Spieler getrennt',
                subtitle: mainapp.players[info.data].name + ' ist getrennt und wurde durch einen Bot ersetzt.'
            });
            mainapp.players[info.data].isBot = true;
            break;
        case 'playerRejoining':
            changeTitles({
                title: 'Spieler wieder verbunden',
                subtitle: mainapp.players[info.data].name + ' spielt ab sofort wieder mit!'
            });
            mainapp.players[info.data].isBot = false;
            break;
        case 'rejoinConfirmed':
            if (info.data.status == 'roundStart') {
                mainapp.round = info.data.round;
                mainapp.rounds = info.data.rounds;
                mainapp.trump = undefined;
                mainapp.selectedTricks = 0;
                mainapp.cardsOnTable = [];
                for (var i = 0; i < info.data.players.length; i++) {
                    info.data.players[i].predictedTricks = '-';
                    info.data.players[i].tricks = '-';
                }
                mainapp.players = info.data.players;
                mainapp.playerIndex = info.data.playerIndex;
                mainapp.cards = {};
                mainapp.cardsOnTableShown = false;
                var names = [];
                for (var i = 0; i < mainapp.players.length; i++) names.push(mainapp.players[i].name);
                while (names[0] != mainapp.players[info.data.roundStartedBy].name) names.push(names.shift());
                mainapp.playerLabels = names;
                mainapp.cardsVisible = false;
                mainapp.cardsUnfolded = false;
                mainapp.cardsShown = false;
            } else if (info.data.status == 'trickAskRound') {
                mainapp.round = info.data.round;
                mainapp.rounds = info.data.rounds;
                mainapp.trump = info.data.trump;
                mainapp.selectedTricks = info.data.selectedTricks;
                mainapp.cardsOnTable = [];
                for (var i = 0; i < info.data.players.length; i++) info.data.players[i].tricks = '-';
                mainapp.players = info.data.players;
                mainapp.playerIndex = info.data.playerIndex;
                mainapp.cards = info.data.cards;
                mainapp.cardsOnTableShown = false;
                var names = [];
                for (var i = 0; i < mainapp.players.length; i++) names.push(mainapp.players[i].name);
                while (names[0] != mainapp.players[info.data.roundStartedBy].name) names.push(names.shift());
                mainapp.playerLabels = names;
                mainapp.cardsVisible = true;
                mainapp.cardsUnfolded = true;
                mainapp.cardsShown = info.data.cardsShown;
            } else if (info.data.status == 'trickRound') {
                mainapp.round = info.data.round;
                mainapp.rounds = info.data.rounds;
                mainapp.trump = info.data.trump;
                mainapp.selectedTricks = info.data.selectedTricks;
                mainapp.cardsOnTable = info.data.cardsOnTable;
                mainapp.players = info.data.players;
                mainapp.playerIndex = info.data.playerIndex;
                mainapp.cards = info.data.cards;
                mainapp.cardsOnTableShown = false;
                mainapp.startPlayer = info.data.roundStartedBy;
                var names = [];
                for (var i = 0; i < mainapp.players.length; i++) names.push(mainapp.players[i].name);
                while (names[0] != mainapp.players[info.data.roundStartedBy].name) names.push(names.shift());
                mainapp.playerLabels = names;
                mainapp.cardsVisible = true;
                mainapp.cardsUnfolded = true;
                mainapp.cardsShown = true;
            } 
            changeTitles({
                title: 'Spiel beigetreten',
                subtitle: 'Ab sofort kannst du wieder mitspielen!'
            });
            infoapp.infoPanelVisible = false;
            wait(1000).then(() => {
                infoapp.infoPanelShown = false;
                mainapp.mainPanelShown = true;
                return wait(1000);
            }).then(() => {
                mainapp.mainPanelVisible = true;
            });
            break;
        case 'endGame':
            endTheGame();
            break;
        case 'newHost':
            for (var i = 0; i < mainapp.players.length; i++) mainapp.players[i].isHost = (i == info.data);
            break;
        case 'gameTooLong':
            alert("Das Spiel zieht sich jetzt bereits über 2 Tage und wurde daher beendet.");
            window.location.reload();
            break;
    }
}

function respondToServer(rid, data) {
    socket.emit('response', {
        rid: rid,
        data: data
    });
}

function sendServerInfo(msg, data) {
    socket.emit('info', {
        msg: msg,
        data: data
    });
}

function wait(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

function changeTitles(data) {
    if (data.title == undefined) data.title = '';
    if (data.subtitle == undefined) data.subtitle = '';
    if (data.title != mainapp.title) mainapp.isTitleChanging = true;
    if (data.subtitle != mainapp.subtitle) mainapp.isSubtitleChanging = true;
    wait(250).then(() => {
        mainapp.title = data.title;
        mainapp.isTitleChanging = false;
        return wait(500);
    }).then(() => {
        mainapp.subtitle = data.subtitle;
        mainapp.isSubtitleChanging = false;
    });
} 

function launchGame(data) {
    mainapp.title = 'Willkommen!';
    mainapp.subtitle = 'Das Spiel beginnt in wenigen Sekunden.';
    mainapp.round = 0;
    mainapp.rounds = data.maxRounds;
    mainapp.playerIndex = data.index;
    mainapp.gameStatus = 0;
    mainapp.selectedTricks = 0;
    mainapp.cards = {};
    mainapp.cardsVisible = false;
    mainapp.cardsUnfolded = false;
    mainapp.cardsShown = false;
    mainapp.players = [];
    mainapp.playerLabels = [];
    mainapp.chat = [];
    mainapp.isHost = startapp.isHost;
    for (var i = 0; i < data.players.length; i++) {
        mainapp.players.push({
            name: data.players[i].name,
            isBot: data.players[i].isBot,
            isHost: data.players[i].isHost,
            color: data.players[i].color,
            credits: 0,
            predictedTricks: '-',
            tricks: '-'
        });
        mainapp.playerLabels.push(data.players[i].name);
    }
    startapp.shownSmallPanel = 3;
    startapp.startPanelVisible = false;
    wait(500).then(() => {
        startapp.startPanelShown = false;
        mainapp.mainPanelShown = true;
        return wait(500);
    }).then(() => {
        mainapp.mainPanelVisible = true;
    });
}

function activateTimer(deadline) {
    mainapp.timerVisible = true;
    var token = Date.now();
    mainapp.timerToken = token;
    wait(1100).then(() => {
        if (mainapp.timerToken == token) {
            var duration = deadline - Date.now();
            mainapp.timer = (duration / 1000) + 's';
            mainapp.timerActive = true;
            return wait(duration);
        }
    }).then(() => {
        if (mainapp.timerToken == token) {
            mainapp.timer = '1s';
            mainapp.timerVisible = false;
            return wait(1000);
        }
    }).then(() => {
        if (mainapp.timerToken == token) mainapp.timerActive = false;
    });
}

function cancelTimer() {
    mainapp.timerToken = 0;
    mainapp.timer = '1s';
    mainapp.timerVisible = false;
    wait(1000).then(() => { mainapp.timerActive = false; });
}

function translateCardName(string) {
    var name = 'die '
    var map = { r: 'rote', b: 'blaue', g: 'grüne', y: 'gelbe' };
    name += map[string[0]] + ' ';
    if (string[1] == 'n') name = 'einen Narr';
    else if (string[1] == 'z') name = 'einen Zauberer';
    else name += string.slice(1);
    return name;
}

function parsePlayerPoints(index, points) {
    var trickDif = mainapp.players[index].tricks - mainapp.players[index].predictedTricks;
    var text = '';
    var name = mainapp.players[index].name;
    if (index == mainapp.playerIndex) text += 'Du hast ';
    else text += name + ' hat ';
    if (trickDif > 0) text += trickDif + ' Stich(e) zu viel';
    else if (trickDif < 0) text += (-trickDif) + ' Stich(e) zu wenig';
    else text += 'richtig geschätzt';
    if (index == mainapp.playerIndex) text += ' und erhältst ' + points + ' Punkte.';
    else text += ' und erhält ' + points + ' Punkte.';
    return text;
}