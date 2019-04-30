var rimraf = require('rimraf')
var test = require('tape')
var pump = require('pump')
var tmpdir = require('tmp').dirSync
var kappafs = require('./')
var mkdirp = require('mkdirp')

var tmp = function () {
  var dir = tmpdir().name
  mkdirp.sync(dir)
  return dir
}

test('basic: write and read latest value', function (t) {
  var drive = kappafs(tmp())

  drive.ready(() => {
    drive.writeFile('/hello.txt', 'world', function (err) {
      t.error(err)
      drive.readFile('/hello.txt', function (err, content) {
        t.error(err)
        t.same(content.toString(), 'world')
        t.end()
      })
    })
  })
})

test('basic: writeStream and readStream', function (t) {
  var drive = kappafs(tmp())
  drive.ready(() => {
    var ws = drive.createWriteStream('/hello.txt')
    ws.end('world')
    ws.on('finish', () => {
      var rs = drive.createReadStream('/hello.txt')
      rs.on('data', (data) => {
        t.same(data.toString(), 'world')
        t.end()
      })
    })
  })
})

test('multiwriter: defaults to latest value', function (t) {
  var drive = kappafs(tmp())
  var drive2 = kappafs(tmp())

  drive.ready(() => {
    drive.writeFile('/hello.txt', 'world', function (err) {
      t.error(err)
      drive.writeFile('/hello.txt', 'mundo', function (err) {
        t.error(err)
        sync()
      })
    })
  })

  function writeSecond (cb) {
    drive2.ready(() => {
      drive2.writeFile('/hello.txt', 'verden', function (err) {
        t.error(err)
        cb()
      })
    })
  }

  function sync () {
    replicate(drive, drive2, (err) => {
      t.error(err)
      writeSecond(() => {
        replicate(drive, drive2, (err) => {
          t.error(err)
          drive.readFile('/hello.txt', function (err, data) {
            t.error(err)
            // drive has the new changes
            t.same(data.toString(), 'verden')
            t.end()
          })
        })
      })
    })
  }
})

test('multiwriter defaults to latest value with streams', function (t) {
  var drive = kappafs(tmp())
  var drive2 = kappafs(tmp())

  drive.ready(() => {
    drive2.ready(() => {
      var ws = drive.createWriteStream('/hello.txt')
      ws.on('finish', sync)
      ws.end('mundo')
    })
  })

  function writeSecond (cb) {
    var ws = drive2.createWriteStream('/hello.txt')
    ws.on('finish', cb)
    ws.on('error', t.error)
    ws.end('verden')
  }

  function sync () {
    replicate(drive, drive2, (err) => {
      t.error(err)
      writeSecond(() => {
        replicate(drive, drive2, (err) => {
          t.error(err)
          var rs = drive.createReadStream('/hello.txt')
          rs.on('data', (data) => {
            t.same(data.toString(), 'verden')
            t.end()
          })
        })
      })
    })
  }
})

test('fork', function (t) {
  var drive = kappafs(tmp())
  var drive2 = kappafs(tmp())

  drive.ready(() => {
    drive2.ready(() => {
      var ws = drive.createWriteStream('/hello.txt')
      ws.end('world')
      ws.on('finish', () => replicate(drive, drive2, writeFork))
    })
  })

  function writeFork () {
    var pending = 2
    var done = () => !--pending && replicate(drive, drive2, checkFork)
    var ws = drive.createWriteStream('/hello.txt')
    ws.on('finish', done)
    ws.end('mundo')
    var ws2 = drive2.createWriteStream('/hello.txt')
    ws2.on('finish', done)
    ws2.end('verden')
  }

  function checkFork () {
    var ws = drive.createWriteStream('/hello.txt')
    ws.end('whateverr')
    ws.on('finish', () => {
      drive2.readFile('/hello.txt', 'utf-8', function (err, _drive2) {
        t.error(err)
        t.same(_drive2, 'verden')
        drive.readFile('/hello.txt', 'utf-8', function (err, _drive1) {
          t.error(err)
          t.same(_drive1, 'whateverr')
          t.end()
        })
      })
    })
  }
})

function replicate (drive1, drive2, cb) {
  var s = drive1.replicate()
  var d = drive2.replicate()
  pump(d, s, d, cb)
}
