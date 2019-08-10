const ram = require('random-access-memory')
const rimraf = require('rimraf')
const { mount, unmount, getHandlers  } = require('hyperdrive-fuse')
const KappaDrive = require('./')
const mkdirp = require('mkdirp').sync
const MOUNTDIR = './mnt'

async function peerfsMount (drive) {
  mkdirp(MOUNTDIR)
  var { destroy } = await mount(drive, MOUNTDIR)
  process.once('SIGINT', () => cleanup(destroy))
}

var drive = KappaDrive(ram)
peerfsMount(drive)

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
