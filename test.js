var ram = require('random-access-memory')
var test = require('tape')
var kappadrive = require('./')

test('test default to latest value', function (t) {
  var drive = kappadrive(ram)
  var drive2 = kappadrive(ram)

  drive.ready(() => {
    drive.writeFile('/hello.txt', 'world', function (err) {
      t.error(err)
      drive.writeFile('/hello.txt', 'mundo', function (err) {
        t.error(err)
        writeSecond()
      })
    })
  })

  function writeSecond () {
    drive2.ready(() => {
      drive2.writeFile('/hello.txt', 'verden', function (err) {
        t.error(err)
        sync()
      })
    })
  }

  function sync () {
    var stream = drive.replicate()
    var res = stream.pipe(drive2.replicate()).pipe(stream)
    res.on('end', () => {
      drive.readFile('/hello.txt', function (err, data) {
        t.error(err)
        // drive has the new changes
        console.log(data)
      })
    })
  }
})
