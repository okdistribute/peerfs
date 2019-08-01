const { describe } = require('tape-plus')
const ram = require('random-access-memory')
const crypto = require('hypercore-crypto')
const Stat = require('hyperdrive/lib/stat')

const KappaDrive = require('../')

const replicate = require('./lib/replicate')
const tmp = require('./lib/tmp')
const cleanup = require('./lib/cleanup')
const uniq = require('./lib/uniq')

// A lot of these tests are just re-testing Hyperdrive,
// ensuring the fs API is the same in KappaDrive
// but ultimately we're re-testing _whoHasFile most of the time

describe('basic', (context) => {
  context('write and read latest value', (assert, next) => {
    var drive = KappaDrive(ram)

    drive.ready(() => {
      drive.writeFile('/hello.txt', 'world', (err) => {
       assert.error(err, 'no error')
        drive.readFile('/hello.txt', (err, content) => {
         assert.error(err, 'no error')
         assert.same(content, Buffer.from('world'))
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
          assert.same(data, Buffer.from('world'))
          next()
        })
      })
    })
  })

  context('open', (assert, next) => {
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      drive.open('/hello.txt', 'w+', function (err, fd) {
        assert.error(err, 'no error')
        assert.same(typeof fd, 'number', `returns a reference to the drive's file descriptor`)
        next()
      })
    })
  })

  context('exists', function (assert, next) {
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

  context('stat', function (assert, next) {
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      drive.writeFile('/hello.txt', 'world', (err) => {
        assert.error(err, 'no error')
        drive.stat('/hello.txt', (err, stats) => {
          assert.error(err, 'no error')
          assert.ok(stats instanceof Stat)
          next()
        })
      })
    })
  })

  context('lstat', function (assert, next) {
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      drive.writeFile('/hello.txt', 'world', (err) => {
        assert.error(err, 'no error')
        drive.lstat('/hello.txt', (err, stats) => {
          assert.error(err, 'no error')
          assert.ok(stats instanceof Stat)
          next()
        })
      })
    })
  })

  context('symlink', function (assert, next) {
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      drive.writeFile('/hello.txt', 'world', (err) => {
        assert.error(err, 'no error')
        drive.symlink('/hello.txt', '/world.txt', (err) => {
          assert.error(err, 'no error')
          drive.readFile('/world.txt', (err, data) => {
            assert.same(data, Buffer.from('world'), 'symlinked')
            next()
          })
        })
      })
    })
  })

  context('truncate', function (assert, next) {
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

  context('keys', function (assert, next) {
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      assert.ok(Buffer.isBuffer(drive.key), 'drive.key returns a buffer')
      assert.ok(Buffer.isBuffer(drive.discoveryKey), 'drive.discoveryKey returns a buffer')
      next()
    })
  })

  context('readdir', function (assert, next) {
    const filesToWrite = [
      '/stuff/things/ape.txt',
      '/badger_number_one.txt' 
    ]
    var drive = KappaDrive(tmp())
    drive.ready(() => {
      drive.writeFile(filesToWrite[0], 'tree', (err) => {
        assert.error(err, 'no error')
        drive.writeFile(filesToWrite[1], 'peanut', (err) => {
          assert.error(err, 'no error')
          drive.readdir('/', (err, files) => {
            assert.error(err, 'no error')
            assert.deepEqual(files.sort, filesToWrite.sort, 'files are the same')
            drive.readdir('/stuff', (err, files) => {
              assert.error(err, 'no error')
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
        assert.error(err, 'no error')
        drive.writeFile('/hello.txt', 'mundo', (err) => {
          assert.error(err, 'no error')
          sync()
        })
      })
    })

    function writeSecond (cb) {
      drive2.writeFile('/hello.txt', 'verden', (err) => {
        assert.error(err, 'no error')
        cb()
      })
    }

    function sync () {
      drive2.ready(() => {
        drive2.writeFile('test.txt', 'testing', (err) => {
          replicate(drive, drive2, (err) => {
            assert.error(err, 'no error')
            writeSecond(() => {
              replicate(drive, drive2, (err) => {
                assert.error(err, 'no error')
                drive.readFile('/hello.txt', (err, data) => {
                  assert.error(err, 'no error')
                  assert.same(data, Buffer.from('verden'), 'gets latest value')
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
      ws.on('error', assert.error)
      ws.end('verden')
    }

    function sync () {
      replicate(drive, drive2, (err) => {
        assert.error(err, 'no error')
        writeSecond(() => {
          replicate(drive, drive2, (err) => {
            assert.error(err, 'no error')
            var rs = drive.createReadStream('/hello.txt')
            rs.on('data', (data) => {
              assert.same(data, Buffer.from('verden'), 'gets latest value')
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
    cleanup('./tmp')
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
        drive2.readFile('/hello.txt', 'utf-8', (err, data) => {
          assert.error(err, 'no error')
          assert.same(data, 'verden')
          drive.readFile('/hello.txt', 'utf-8', (err, data) => {
            assert.error(err, 'no error')
            assert.same(data, 'whateverr', 'forked values')
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
      assert.same(drive.key, accessKey, 'drive key is access key')
      assert.same(drive.core._logs._fake.key, accessKey, '_fake key is access key')
      var keys = [
        { name: 'state', key: drive.state.key },
        { name: 'metadata', key: drive.metadata.key },
        { name: 'content', key: drive.content.key }
      ]
      keys.forEach((obj) => assert.notEqual(obj.key, accessKey, `${obj.name} key is different to the access key`))
      next()
    })
  })
})


describe('signing', (context) => {
  context('using a custom keypair', (assert, next) => {
    var accessKey = crypto.randomBytes(32)
    var keyPair = crypto.keyPair()

    var drive = KappaDrive(ram, {
      key: keyPair.publicKey,
      secretKey: keyPair.secretKey
    })

    drive.ready(() => {
      // TODO: why does the multiplexer work here if all the keys are the same?
      // Check what the feeds actually look like, we need to check if there is any conflict in replication
      var keys = uniq([drive.state.key, drive.metadata.key, drive.content.key])
      assert.same(keys.length, 1, 'uses only one keypair for all writable feeds')
      assert.same(keys[0], keyPair.publicKey, 'key matches passed public key')
      next()
    })
  })
})
