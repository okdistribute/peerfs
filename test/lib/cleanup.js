const rimraf = require('rimraf')
const debug = require('debug')('cleanup')

module.exports = function (dir) {
  rimraf(dir, (err) => {
    debug("cleanup: ", err ? "FAILED" : "SUCCESS")
    if (err) throw (err)
  })
}
