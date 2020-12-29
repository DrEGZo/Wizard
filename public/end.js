function submain() {
    endapp = new Vue({
        el: '#endpanel',
        data: {
            endPanelShown: false,
            endPanelVisible: false,
            winners: [],
            losers: []
        },
        methods: {
            quitGame: function () {
                this.endPanelVisible = false;
                wait(1000).then(() => { window.location.reload() });
            },
            getPlayerStyle: function (place) {
                var res = {
                    'endplayer-0': false,
                    'endplayer-1': false,
                    'endplayer-2': false,
                    'endplayer-3': false,
                    'endplayer-4': false,
                    'endplayer-5': false,
                };
                res['endplayer-' + place] = true;
                return res;
            }
        },
        computed: {
            isEndPanelVisible: function () {
                if (this.endPanelVisible) return { opacity: 1 };
                else return { opacity: 0 };
            }
        }
    });
}

function endTheGame() {
    changeTitles({
        title: 'Spielende',
        subtitle: 'Das Spiel ist hiermit beendet!'
    });
    var credits = [];
    for (var i = 0; i < mainapp.players.length; i++) {
        if (credits.indexOf(mainapp.players[i].credits) == -1) credits.push(mainapp.players[i].credits);
    }
    credits = credits.sort((a, b) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
    });
    var players = [];
    for (var i = 0; i < mainapp.players.length; i++) players.push({
        name: mainapp.players[i].name,
        credits: mainapp.players[i].credits,
        color: mainapp.players[i].color,
        place: credits.indexOf(mainapp.players[i].credits)
    });
    players = players.sort((a, b) => {
        if (a.place < b.place) return -1;
        if (a.place > b.place) return 1;
        return 0;
    });
    for (var i = 0; i < players.length; i++) {
        if (i < 3) endapp.winners.push(players[i]);
        else endapp.losers.push(players[i]);
    }
    wait(5000).then(() => {
        mainapp.mainPanelVisible = false;
        return wait(1000);
    }).then(() => {
        mainapp.mainPanelShown = false;
        endapp.endPanelShown = true;
        return wait(1000);
    }).then(() => {
        endapp.endPanelVisible = true;
    });
}