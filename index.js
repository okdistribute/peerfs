var kappa = require('kappa-core')
var debug = require('debug')('kappa-fs')
var kv = require('kappa-view-kv')
var memdb = require('memdb')
var hyperdrive = require('hyperdrive')
var duplexify = require('duplexify')

function dumbMerge (values) {
  return values[0]
}

class KappaDrive {
  constructor (storage, opts) {
    if (!opts) opts = {}
    // TODO: encode messages for robustness
    this.core = kappa(storage)
    this._storage = storage
    this._index = opts.index || memdb()
    this._resolveFork = opts.resolveFork || dumbMerge

    this.kvidx = kv(this._index, function (msg, next) {
      var ops = []
      var msgId = msg.key + '@' + msg.seq
      // TODO: ew, json?
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

  _whoHasFile (filename, cb) {
    this.core.ready('kv', () => {
      this.core.api.kv.get(filename, (err, values) => {
        if (err && !err.notFound) return cb(err)
        if (!values || !values.length) return cb(null, this.drive)
        var winner = this._resolveFork(values)
        // TODO: allow multiple winners
        var value = JSON.parse(winner.value)
        this._getDrive(value.metadata, value.content, cb)
      })
    })
  }

  createReadStream (filename) {
    var proxy = duplexify()
    this._whoHasFile(filename, (err, drive) => {
      if (err) return proxy.emit('err', err)
      proxy.setReadable(drive.createReadStream(filename))
    })
    return proxy
  }

  readFile (filename, opts, cb) {
    if (!this._open) throw new Error('not ready yet, try calling .ready')
    this._whoHasFile(filename, (err, drive) => {
      if (err) return cb(err)
      drive.readFile(filename, opts, cb)
    })
  }

  _getLinks (filename, cb) {
    this.core.ready('kv', () => {
      this.core.api.kv.get(filename, (err, values) => {
        if (err && !err.notFound) return cb(err)
        var links = values ? values.map((v) => v.key + '@' + v.seq) : []
        return cb(null, links)
      })
    })
  }

  _finishWrite (filename, links, cb) {
    var res = {
      filename,
      links
    }

    // TODO: we probably should record the seq of the metadata/content as well
    // and perform a checkout to that hyperdrive seq on reads
    res.metadata = this.drive.metadata.key.toString('hex')
    res.content = this.drive.content.key.toString('hex')

    debug('writing finished', res)

    // TODO: ew JSON stringify is slow... lets use protobuf instead
    this.local.append(JSON.stringify(res), cb)
  }

  writeFile (filename, content, cb) {
    this._getLinks(filename, (err, links) => {
      if (err) return cb(err)
      this.drive.writeFile(filename, content, (err) => {
        if (err) return cb(err)
        this._finishWrite(filename, links, cb)
      })
    })
  }

  createWriteStream (filename) {
    var proxy = duplexify()
    this._getLinks(filename, (err, links) => {
      if (err) proxy.emit('error', err)
      var writer = this.drive.createWriteStream(filename)
      proxy.setWritable(writer)

      var prefinish = () => {
        proxy.cork()
        this._finishWrite(filename, links, (err) => {
          if (err) return proxy.destroy()
          proxy.uncork()
        })
      }

      proxy.on('close', done)
      proxy.on('finish', done)
      proxy.on('prefinish', prefinish)

      function done () {
        proxy.removeListener('close', done)
        proxy.removeListener('finish', done)
        proxy.removeListener('prefinish', prefinish)
      }
    })

    return proxy
  }

  open (cb) {
    this.core.feed('peerfs', (err, feed) => {
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

  replicate () {
    return this.core.replicate()
  }
}

module.exports = function (storage, opts) {
  // what do we do with the key??
  return new KappaDrive(storage, opts)
}
