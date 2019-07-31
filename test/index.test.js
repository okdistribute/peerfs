const { describe } = require('tape-plus')
const ram = require('random-access-memory')
const crypto = require('hypercore-crypto')

const KappaDrive = require('../')

const replicate = require('./lib/replicate')
const tmp = require('./lib/tmp')
const cleanup = require('./lib/cleanup')
const uniq = require('./lib/uniq')

describe('basic', (context) => {
  context('write and read latest value', (assert, next) => {
    var drive = KappaDrive(ram)

    drive.ready(() => {
      drive.writeFile('/hello.txt', 'world', (err) => {
       assert.error(err)
        drive.readFile('/hello.txt', (err, content) => {
         assert.error(err)
         assert.same(content.toString(), 'world')
         next()
        })
      })
    })
  })

  context('writeStream and readStream', (assert, next) => {
    var drive = KappaDrive(ram)
    drive.ready(() => {
      var ws = drive.createWriteStream('/hello.txt')
      ws.end('world')
      ws.on('finish', () => {
        var rs = drive.createReadStream('/hello.txt')
        rs.on('data', (data) => {
          assert.same(data.toString(), 'world')
          next()
        })
      })
    })
  })

  context('basic: exists', function (assert, next) {
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      drive.exists('/hello.txt', function (bool) {
        assert.notOk(bool, 'no file yet')
        drive.writeFile('/hello.txt', 'world', function (err) {
          assert.error(err, 'no error')
          drive.exists('/hello.txt', function (bool) {
            assert.ok(bool, 'found file')
            next()
          })
        })
      })
    })
  })

  context('basic: truncate', function (assert, next) {
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      drive.writeFile('/hello.txt', 'world', (err) => {
        assert.error(err, 'no error')
        drive.truncate('/hello.txt', 1, (err) => {
          assert.error(err, 'no error')
          drive.readFile('/hello.txt', (err, data) => {
            assert.deepEqual(Buffer.from('w'), data, 'truncated file')
            next()
          })
        })
      })
    })
  })

  context('basic: give keys', function (assert, next) {
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      assert.ok(Buffer.isBuffer(drive.key), 'drive.key returns a buffer')
      assert.ok(Buffer.isBuffer(drive.discoveryKey), 'drive.discoveryKey returns a buffer')
      next()
    })
  })

  context('basic: readdir', function (assert, next) {
    const filesToWrite = [
      '/stuff/things/ape.txt',
      '/badger_number_one.txt' 
    ]
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      drive.writeFile(filesToWrite[0], 'tree', (err) => {
        assert.notOk(err)
        drive.writeFile(filesToWrite[1], 'peanut', (err) => {
          assert.notOk(err)
          drive.readdir('/', (err, files) => {
            assert.notOk(err)
            assert.deepEqual(files.sort, filesToWrite.sort, 'files are the same')
            drive.readdir('/stuff', (err, files) => {
              assert.error(err)
              assert.equal(filesToWrite[0], files[0], 'can specify directory')
              next()
            })
          })
        })
      })
    })
  })
})

describe('multiwriter', (context) => {
  context('defaults to latest value', (assert, next) => {
    var drive = KappaDrive(ram)
    var drive2 = KappaDrive(ram)

    drive.ready(() => {
      drive.writeFile('/hello.txt', 'world', (err) => {
        assert.error(err)
        drive.writeFile('/hello.txt', 'mundo', (err) => {
          assert.error(err)
          sync()
        })
      })
    })

    function writeSecond (cb) {
      drive2.writeFile('/hello.txt', 'verden', (err) => {
        assert.error(err)
        cb()
      })
    }

    function sync () {
      drive2.ready(() => {
        drive2.writeFile('test.txt', 'testing', (err) => {
          replicate(drive, drive2, (err) => {
            assert.error(err)
            writeSecond(() => {
              replicate(drive, drive2, (err) => {
                assert.error(err)
                drive.readFile('/hello.txt', (err, data) => {
                  assert.error(err)
                  assert.same(data.toString(), 'verden')
                  next()
                })
              })
            })
          })
        })
      })
    }
  })

  context('defaults to latest value with streams', (assert, next) => {
    var drive = KappaDrive(ram)
    var drive2 = KappaDrive(ram)

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
      ws.on('error',assert.error)
      ws.end('verden')
    }

    function sync () {
      replicate(drive, drive2, (err) => {
        assert.error(err)
        writeSecond(() => {
          replicate(drive, drive2, (err) => {
            assert.error(err)
            var rs = drive.createReadStream('/hello.txt')
            rs.on('data', (data) => {
              assert.same(data.toString(), 'verden')
              next()
            })
          })
        })
      })
    }
  })
})

// TODO: figure out why this resolves incorrectly when in memory
describe('conflict', (context) => {
  var storage1, storage2

  context.beforeEach((c) => {
    storage1 = tmp()
    storage2 = tmp()
  })

  context.afterEach((c) => {
    cleanup(storage1)
    cleanup(storage2)
  })

  context('fork', (assert, next) => {
    var drive = KappaDrive(storage1)
    var drive2 = KappaDrive(storage2)

    drive.ready(() => {
      drive2.ready(() => {
        var ws = drive.createWriteStream('/hello.txt')
        ws.end('world')
        ws.on('finish', (err) => replicate(drive, drive2, writeFork))
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
        drive2.readFile('/hello.txt', 'utf-8', (err, _drive2) => {
          assert.error(err)
          assert.same(_drive2, 'verden')
          drive.readFile('/hello.txt', 'utf-8', (err, _drive1) => {
            assert.error(err)
            assert.same(_drive1, 'whateverr')
            next()
          })
        })
      })
    }
  })
})

describe('read access', (context) => {
  context('accepts a top-level key for replication' , (assert, next) => {
    var accessKey = crypto.randomBytes(32)

    var drive = KappaDrive(ram, { protocolEncryptionKey: accessKey })

    drive.ready(() => {
      assert.same(drive.key, accessKey)
      assert.same(drive.core._logs._fake.key, accessKey)
      var keys = [drive.state.key, drive.metadata.key, drive.content.key]
      keys.forEach((key) => assert.notEqual(key, accessKey))
      next()
    })
  })
})


describe('signing', (context) => {
  context('sign drive using a custom keypair', (assert, next) => {
    var accessKey = crypto.randomBytes(32)
    var keyPair = crypto.keyPair()

    var drive = KappaDrive(ram, {
      protocolEncryptionKey: accessKey,
      key: keyPair.publicKey,
      secretKey: keyPair.secretKey
    })

    drive.ready(() => {
      var keys = uniq([drive.state.key, drive.metadata.key, drive.content.key])
      assert.same(keys.length, 1)
      assert.same(keys[0], keyPair.publicKey)
      next()
    })
  })
})
