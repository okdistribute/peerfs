const ram = require('random-access-memory')
const rimraf = require('rimraf')
const { mount, unmount, getHandlers  } = require('hyperdrive-fuse')
const KappaDrive = require('./')

async function peerfsMount () {
  var drive = KappaDrive(ram)
  var { destroy } = await mount(drive, './mnt')
  process.once('SIGINT', () => cleanup(destroy))
}

peerfsMount()

function cleanup (destroy) {
  return new Promise((resolve, reject) => {
    destroy(err => {
      if (err) return reject(err)
      rimraf('./mnt', err => {
        if (err) return reject(err)
        return resolve()
      })
    })
  })
}
