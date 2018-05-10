/*
scannerPoloniex.js

- open poloniex websocket
- get pairs
- every interval seconds, write candle and get pairs again
    - candle data will be compiled from a list of trades for each pair
    - trades are a set of amount and price
        - Ex: trades['BTC_ETH'][0].amount
          trades = {
              'BTC_ETH': [
                  {amount: 1, price: 2},
                  {amount: 3, price: 4}
              ]
          }

*/

// imports
const fs = require('fs')
const Poloniex = require('poloniex-api-node')

// vars
const interval = 15 // seconds between updating pairs
const poloniex = new Poloniex()
const tsStart = (new Date()).getTime()/1000
var tsLast = {} // object storing last update for each pair
var trades = {} // object containing lists of trades used to compile the next candles
var subs = [] // list of currency pairs that im currently subscribed too

// functions
_getSubs = function () {
    // update subscriptions from json file
    // does not reset trades, but if new pair is added, initialize it in trades
    let pairs = JSON.parse(fs.readFileSync('pairsPoloniex.json'))
    // get newSubs
    let newSubs = []
    for (base in pairs) {
        for (i in pairs[base]) {
            let asset = pairs[base][i]
            let pair = asset+base
            let currencyPair = base+"_"+asset
            if (newSubs.indexOf(currencyPair) < 0) {
                newSubs.push(currencyPair)
            }
        }
    }
    // unsub outdated subs
    for (i in subs) {
        if (newSubs.indexOf(subs[i]) < 0) {
            console.log("Removing subscription to "+subs[i]+".")
            delete tsLast[subs[i]]
            poloniex.unsubscribe(subs[i])
            subs.splice(i)
        }
    }
    // add new subs
    for (i in newSubs) {
        if (subs.indexOf(newSubs[i]) < 0) {
            console.log("Adding subscription to "+newSubs[i]+".")
            trades[newSubs[i]] = []
            tsLast[newSubs[i]] = (new Date()).getTime()
            poloniex.subscribe(newSubs[i])
            subs.push(newSubs[i])
        }
    }
    //console.log(JSON.stringify(trades))
}

_writeCandle = function () {
    let ts = (new Date()).getTime()
    // backup and reset trades
    let tradesData = {}
    for (currencyPair in trades) {
        tradesData[currencyPair] = trades[currencyPair]
        trades[currencyPair] = []
    }

    // get ohlc
    for (currencyPair in tradesData) {
        console.log("Finding ohlc for "+currencyPair)
        let _trades = tradesData[currencyPair]
        let _len = _trades.length
        /*
        let _ohlc = [
            _trades[0].price,
            _trades[0].price,
            _trades[0].price,
            _trades[_len - 1].price
        ]
        for (i in _trades) {
            let _trade = _trades[i]
            if (_trade.price > _ohlc[1]) {
                _ohlc[1] = _trade.price
            }
            if (_trade.price < _ohlc[2]) {
                _ohlc[2] = _trade.price
            }
        }
        console.log("ohlc: "+_ohlc)
        */
    }

    //console.log("Writing candle")
    //console.log(tradesData)
    console.log(tsLast)
}

// initialize websocket
poloniex.on('open', (msg) => {
    console.log("Poloniex WebSocket open.")
    _getSubs()
})

poloniex.on('close', (reason) => {
    console.log("Poloniex WebSocket closed.")
})

poloniex.on('message', (channelName, data, seq) => {
    try {
        for (i in data) {
            if (data[i].type == "newTrade") {
                trades[channelName].push({
                    amount: parseFloat(data[i].data.amount),
                    price: parseFloat(data[i].data.rate)
                })
            }
        }
    } catch (err) {
        console.log(err)
    }
})

poloniex.on('error', (err) => {
    if (typeof(err) != "string") {
        err = JSON.stringify(err)
    }
    console.log("Warning: "+err)
})

poloniex.openWebSocket({version: 2})

// write candle data
hr = "=========================================="
console.log(hr)
setInterval(() => {
    console.log(hr)
    _writeCandle()
    _getSubs()
}, interval*1000)