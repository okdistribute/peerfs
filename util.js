var unixify = require('unixify')

// these are taken from hyperdrive:
// im not sure if we need them on top of hyperdrive
function normalizePath (p) {
  return unixify(path.resolve('/', p))
}

function sanitizeDirs (list) {
  for (var i = 0; i < list.length; i++) {
    if (!noDots(list[i])) return list.filter(noDots)
  }
  return list
}

function noDots (entry) {
  return entry !== '..' && entry !== '.'
}

module.exports = { normalizePath, sanitizeDirs }
