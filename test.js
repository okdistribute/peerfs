var raf = require('random-access-file')
var rimraf = require('rimraf')
var test = require('tape')
var pump = require('pump')
var kappadrive = require('./')

rimraf.sync('./db')

test('test write and read latest value', function (t) {
  var drive = kappadrive('./db')

  drive.ready(() => {
    drive.writeFile('/hello.txt', 'world', function (err) {
      t.error(err)
      drive.readFile('/hello.txt', function (err, content) {
        t.error(err)
        t.same(content, 'world')
        t.end()
      })
    })
  })
})

test.skip('test default to latest value', function (t) {
  var drive = kappadrive(raf)
  var drive2 = kappadrive(raf)

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
    var stream = drive.replicate()
    var d = drive2.replicate()
    pump(d, stream, d, (err) => {
      t.error(err)
      writeSecond(() => {
        var stream = drive.replicate()
        var d = drive2.replicate()
        pump(d, stream, d, (err) => {
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
