/*
scannerGdax.js
Description: A candle data compiler and saver for Gdax exchange. Periodically
cycles through the pairs in pairsGdax.json, compile candle data, and store to
the Data file. See README.md

v1.1
    v1.1.1
    /- use EXCHANGE in WS closed message instead of typing explicitly
    /- stop saying no response from server when WS closed
    /- combine log outputs into one line when WS closed
    /- replace log messages with the new lib.outMsg(str) to add a timestamp
    /- only log err if there was actually an error

*/

// imports
var lib = require('./tgLib'),
    Gdax = require('gdax')

const PAIRSFILE = "pairsGdax.json", // name of file where pairs are stored
    EXCHANGE = "Gdax" // exchange name
var GDAX = new Gdax.PublicClient()

// initialize websocket
function setWSMethods(WS) {
    WS.on('error', (err) => {
        lib.outMsg("Error!")
        if (err) console.log(err)
    })

    WS.on('open', () => {
        lib.startupMessage(EXCHANGE)
    })

    WS.on('close', (res) => {
        lib.outMsg(`${EXCHANGE} WebSocket closed. Trying to reconnect...`)
        setTimeout(() => openWS(), 1000)
    })

    WS.on('message', (msg) => {
        if (msg.type == "match") {
            let pairId = msg.product_id,
                pair = lib.pairIdToPair[pairId]
            if (lib.subs.indexOf(pair) > -1) {
                let amount = parseFloat(msg.size),
                    price = parseFloat(msg.price)
                lib.onTrade(pair, amount, price)
            }
        }
    })
}

function openWS() {
    GDAX = new Gdax.PublicClient()
    // get a list of pairs
    GDAX.getProducts((err, response, data) => {
        if (err) throw err
        for (i in data) {
            let pairId = data[i].id,
                base = data[i].quote_currency,
                asset = data[i].base_currency,
                pair = asset+base
            lib.pairToPairId[pair] = pairId
            lib.pairIdToPair[pairId] = pair
        }
        // set up WS
        GDAX = new Gdax.WebsocketClient(Object.keys(lib.pairIdToPair))
        setWSMethods(GDAX)
    })
}

// script
lib.outLog()
lib.getSubs(PAIRSFILE)
openWS()
// - messages from initializing WS will appear here

// - start collecting
setInterval(() => {
    // save candles and refresh subscriptions every SAVE_INTERVAL
    lib.outLog()
    lib.saveCandles(EXCHANGE)
    lib.getSubs(PAIRSFILE)
}, lib.SAVE_INTERVAL * 1000)
