function start() {
    socket = io();
    socket.on('request', handleRequest);
    socket.on('info', handleInfo);
    startapp = new Vue({
        el: '#startpanel',
        data: {
            startPanelShown: true,
            startPanelVisible: false,
            shownSmallPanel: 0,
            nickname: '',
            nicknameToken: '',
            canRejoin: false,
            rejoinToken: '',
            rejoinData: null,
            isHost: false,
            selectedLobby: null,
            selectedLobbyToken: '',
            selectedMaxRounds: null,
            maxRounds: null,
            leaveLobbyToken: '',
            lobbydata: [],
            lobbyPlayers: [],
            bannedInLobbies: [],
            botAddingToken: '',
            gameLaunchToken: ''
        },
        methods: {
            panelShown: function (index) {
                var notshown = { opacity: '0.2' };
                var shown = { opacity: '1' };
                if (this.shownSmallPanel == index) return shown;
                else return notshown;
            },
            confirmRejoin: function (bool) {
                if (!bool) {
                    respondToServer(this.rejoinToken, false);
                    this.canRejoin = false;
                } else {
                    this.startPanelVisible = false;
                    wait(1000).then(() => {
                        this.startPanelShown = false;
                        infoapp.infoPanelShown = true;
                        return wait(1000);
                    }).then(() => {
                        infoapp.infoPanelVisible = true;
                        return wait(1000);
                    }).then(() => {
                        respondToServer(this.rejoinToken, true);
                    });
                }
            },
            confirmNick: function () {
                if (this.nickname.length > 0 && this.nicknameToken != '') {
                    this.shownSmallPanel++;
                    respondToServer(this.nicknameToken, this.nickname);
                }
            },
            instructions: function () {
                window.open('/anleitung');
            },
            lobbyState: function (index) {
                if (this.lobbydata[index].status == 0) return 'frei';
                else if (this.lobbydata[index].status == 2) return 'im Spiel';
                else {
                    if (this.bannedInLobbies[index]) return 'gebannt';
                    else if (this.lobbydata[index].players != 6) return this.lobbydata[index].players + ' / 6';
                    else return 'voll';
                }
            },
            selectLobby: function (index) {
                if (this.shownSmallPanel == 1
                    && this.lobbydata[index].status != 2
                    && this.lobbydata[index].players < 6
                    && this.bannedInLobbies[index] == false
                ) {
                    if (this.selectedLobby == index) this.selectedLobby = null;
                    else this.selectedLobby = index;
                }
            },
            confirmLobby: function () {
                if (this.lobbyChosen()) {
                    if (this.lobbydata[this.selectedLobby].status != 2
                        && this.lobbydata[this.selectedLobby].players < 6
                    ) {
                        respondToServer(this.selectedLobbyToken, this.selectedLobby);
                        this.shownSmallPanel++;
                    }
                    if (this.lobbydata[this.selectedLobby].status == 0) {
                        this.lobbydata[this.selectedLobby].status = 1;
                        this.isHost = true;
                    }
                }
            },
            updateMaxRounds: function () {
                sendServerInfo('updateMaxRounds', {
                    uid: parseCookies().uid,
                    value: this.selectedMaxRounds
                });
            },
            playerName: function (index) {
                var name = this.lobbyPlayers[index].name;
                if (this.lobbyPlayers[index].isHost) name += ' (Host)';
                if (this.lobbyPlayers[index].isBot) name += ' (Bot)';
                return name; 
            },
            kickPlayer: function (index) {
                respondToServer(this.lobbyPlayers[index].kickRid, null);
            },
            addBot: function () {
                if (this.lobbyPlayers.length < 6) respondToServer(this.botAddingToken, null);
            },
            backToLobbies: function () {
                respondToServer(this.leaveLobbyToken, null);
                this.lobbyPlayers = [];
                this.selectedMaxRounds = null;
                this.maxRounds = null;
                this.isHost = false;
                this.shownSmallPanel--;
            },
            startGame: function () {
                if (this.lobbyPlayers.length >= 3) respondToServer(this.gameLaunchToken, null);
            },
            lobbyChosen: function () {
                return this.selectedLobby != null
                    && this.selectedLobbyToken != ''
                    && (!this.bannedInLobbies[this.selectedLobby]);
            }
        },
        computed: {
            isStartPanelVisible: function () {
                var notshown = { opacity: '0' };
                var shown = { opacity: '1' };
                if (this.startPanelVisible) return shown;
                else return notshown;
            },
            maxRoundsMap: function () {
                var map = [20, 20, 20, 20, 15, 12, 10];
                return map[this.lobbyPlayers.length];
            }
        }
    });
    infoapp = new Vue({
        el: '#infopanel',
        data: {
            info: 'Bitte warte einen Moment, während die Verbindung mit deinem Spiel hergestellt wird...',
            infoPanelShown: false,
            infoPanelVisible: false
        },
        computed: {
            isInfoPanelVisible: function () {
                if (this.infoPanelVisible) return { opacity: 1 };
                else return { opacity: 0 };
            }
        }
    });
    main();
}



function sendUserCookie(rid) {
    var id = parseCookies().uid;
    if (id == undefined) {
        var map = 'abcdefghijklmnopqrstuvwxyz'
        id = '';
        for (var i = 0; i < 20; i++) {
            id += map[Math.floor(Math.random() * 26)];
        }
        id += Date.now();
    }
    expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString() // 1 week
    document.cookie = 'uid=' + id + ';expires=' + expires + ';path=/';
    respondToServer(rid, id);
}

function parseCookies() {
    var cookieString = document.cookie;
    var cookies = {};
    var cookieList = cookieString.split('; ');
    for (var i = 0; i < cookieList.length; i++) {
        name = cookieList[i].split('=')[0];
        value = cookieList[i].split('=')[1];
        cookies[name] = value;
    }
    return cookies;
}

function kickedFromLobby(info) {
    startapp.shownSmallPanel = 1;
    startapp.lobbyPlayers = [];
    startapp.selectedMaxRounds = null;
    startapp.maxRounds = null;
    startapp.selectedLobby = null;
    startapp.bannedInLobbies.splice(info.data, 1, true);
    alert('Du wurdest vom Host gekickt. Du kannst der Lobby in 60 Sekunden erneut beitreten.');
}

