var kappa = require('kappa-core')
var debug = require('debug')('kappa-fs')
var kv = require('kappa-view-kv')
var memdb = require('memdb')
var hyperdrive = require('hyperdrive')

class KappaDrive {
  constructor (storage, opts) {
    this.core = kappa(storage, opts)
    this._storage = storage
    this._index = opts.index || memdb()

    this.kvidx = kv(this._index, function (msg, next) {
      var ops = []
      var msgId = msg.key + '@' + msg.seq
      ops.push({
        filename: msg.value.filename,
        id: msgId,
        links: msg.value.links | []
      })
      next(null, ops)
    })
    this.core.use('kv', this.kvidx)
    this._open(() => {
      debug('ready to go')
    })
  }

  _getDrive (metadata, content, cb) {
    this.core.feed(metadata, (err, metadata) => {
      if (err) return cb(err)
      this.core.feed(metadata, (err, content) => {
        if (err) return cb(err)
        var drive = hyperdrive(this.storage, {metadata, content})
        drive.ready(cb)
      })
    })
  }

  readFile (filename, cb) {
    if (!this.drive) throw new Error('not ready yet, try calling .ready')
    this.core.api.kv.get(filename, (err, values) => {
      if (err) return cb(err)
      // get metadata and content feeds for the values here
      var val = values[0]
      this._getDrive(val.metadata, val.content, (err, drive) => {
        if (err) return cb(err)
        drive.readFile(filename, cb)
      })
    })
  }

  writeFile (filename, content, cb) {
    if (!this.drive) throw new Error('not ready yet, try calling .ready')
    this.core.api.kv.get(filename, (err, values) => {
      if (err) return cb(err)
      var links = values.map((v) => version(this.local, v.seq))
      this.drive.writeFile(filename, content, (err, values) => {
        if (err) return cb(err)
        // whats the seq here?
        this.local.append({
          filename,
          metadata: this.drive.metadata.key.toString('hex'),
          content: this.drive.content.key.toString('hex'),
          links: [links]
        }, cb)
      })
    })
  }

  _open (cb) {
    this.core.feed('local', (err, feed) => {
      if (err) cb(err)
      this.local = feed
      this._getDrive('metadata', 'content', (err, drive) => {
        if (err) return cb(err)
        this._open = true
        if (cb) cb()
      })
    })
  }

  ready (cb) {
    if (this._ready) return cb()
    this._open(cb)
  }
}

module.exports = function (storage, opts) {
  // what do we do with the key??
  return new KappaDrive(storage, opts)
}

function version (feed, seq) {
  return feed.key.toString('hex') + '@' + seq
}
