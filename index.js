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
      try {
        var value = JSON.parse(msg.value)
      } catch (err) {
        return next()
      }
      ops.push({
        key: value.filename,
        id: msgId,
        metadata: value.metadata,
        content: value.content,
        links: value.links || []
      })
      debug('ops', ops)
      next(null, ops)
    })
    this.core.use('kv', this.kvidx)
  }

  _getDrive (metadata, content, cb) {
    if (metadata === this.metadataKey) {
      metadata = 'metadata'
      content = 'content'
    }
    debug('getting drive feed', metadata, content)
    this.core.feed(metadata, (err, metadata) => {
      if (err) return cb(err)
      this.core.feed(content, (err, content) => {
        if (err) return cb(err)
        debug('got feeds', metadata, content)
        var drive = hyperdrive(this._storage, {metadata, content})
        drive.ready(() => cb(null, drive))
      })
    })
  }

  readFile (filename, cb) {
    if (!this._open) throw new Error('not ready yet, try calling .ready')
    this.core.ready('kv', () => {
      this.core.api.kv.get(filename, (err, values) => {
        if (err && !err.notFound) return cb(err)
        // get metadata and content feeds for the values here
        if (!values.length) this.drive.readFile(filename, cb)
        else {
          var v = values[0]
          var value = JSON.parse(v.value)
          debug('readFile for', value)
          this._getDrive(value.metadata, value.content, (err, drive) => {
            if (err) return cb(err)
            drive.readFile(filename, cb)
          })
        }
      })
    })
  }

  replicate () {
    return this.core.replicate()
  }

  writeFile (filename, content, cb) {
    if (!this._open) throw new Error('not ready yet, try calling .ready')
    this.core.ready('kv', () => {
      this.core.api.kv.get(filename, (err, values) => {
        if (err && !err.notFound) return cb(err)
        var links = values ? values.map((v) => v.key + '@' + v.seq) : []
        this.drive.writeFile(filename, content, (err) => {
          if (err) return cb(err)
          var res = {
            filename,
            metadata: this.drive.metadata.key.toString('hex'),
            content: this.drive.content.key.toString('hex'),
            links: links
          }
          debug('appending', content, res, content)
          this.local.append(JSON.stringify(res), cb)
        })
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
        this.metadataKey = drive.metadata.key.toString('hex')
        this.contentKey = drive.content.key.toString('hex')
        this._open = true
        if (cb) cb()
      })
    })
  }

  ready (cb) {
    if (this._open) return cb()
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
