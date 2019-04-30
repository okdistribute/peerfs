var kappa = require('kappa-core')
var debug = require('debug')('kappa-fs')
var kv = require('kappa-view-kv')
var memdb = require('memdb')
var hyperdrive = require('hyperdrive')

class KappaDrive {
  constructor (storage, opts) {
    if (!opts) opts = {}
    // TODO: encode messages for robustness
    this.core = kappa(storage)
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
    this.open(() => {
      debug('ready to go')
    })
  }

  _getDrive (metadataKey, contentKey, cb) {
    this.core.feed(metadataKey, (err, metadata) => {
      if (err) return cb(err)
      this.core.feed(contentKey, (err, content) => {
        if (err) return cb(err)
        var drive = hyperdrive(this._storage, {metadata, content})
        drive.ready(() => cb(null, drive))
      })
    })
  }

  readFile (filename, cb) {
    if (!this._open) throw new Error('not ready yet, try calling .ready')
    this.core.api.kv.get(filename, (err, values) => {
      if (err && !err.notFound) return cb(err)
      // get metadata and content feeds for the values here
      if (!values) this.drive.readFile(filename, cb)
      else {
        var v = values[0]
        debug('v', v)
        this._getDrive(v.metadata, v.content, (err, drive) => {
          if (err) return cb(err)
          drive.readFile(filename, cb)
        })
      }
    })
  }

  replicate () {
    return this.core.replicate()
  }

  writeFile (filename, content, cb) {
    if (!this._open) throw new Error('not ready yet, try calling .ready')
    this.core.api.kv.get(filename, (err, values) => {
      if (err && !err.notFound) return cb(err)
      var links = values ? values.map((v) => version(this.local, v.seq)) : []
      debug('writing', filename, content)
      this.drive.writeFile(filename, content, (err) => {
        if (err) return cb(err)
        // whats the seq here?
        //
        debug('getting', values)
        var res = {
          filename,
          metadata: this.drive.metadata.key.toString('hex'),
          content: this.drive.content.key.toString('hex'),
          links: [links]
        }
        debug('appending', res)
        this.local.append(JSON.stringify(res), cb)
      })
    })
  }

  open (cb) {
    this.core.feed('mydata', (err, feed) => {
      if (err) cb(err)
      this.local = feed
      this._getDrive('metadata', 'content', (err, drive) => {
        if (err) return cb(err)
        this.drive = drive
        this._open = true
        if (cb) cb()
      })
    })
  }

  ready (cb) {
    if (this._ready) return cb()
    console.log('opening')
    this.open(cb)
  }
}

module.exports = function (storage, opts) {
  // what do we do with the key??
  return new KappaDrive(storage, opts)
}

function version (feed, seq) {
  return feed.key.toString('hex') + '@' + seq
}
