module.exports = function replicate (drive1, drive2, cb) {
  var s = drive1.replicate()
  var d = drive2.replicate()

  s.pipe(d).pipe(s)

  s.on('error', () => {
    debug("replicate: ", err ? "FAIL" : "SUCCESS")
    if (err) cb(err)
  })
  s.on('end', cb)
}
