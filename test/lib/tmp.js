const tmpdir = require('tmp').dirSync
const mkdirp = require('mkdirp')

module.exports = function tmp () {
  var dir = '.'+tmpdir().name
  mkdirp.sync(dir)
  return dir
}
