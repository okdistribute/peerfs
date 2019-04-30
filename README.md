# peerfs

A multiwriter peer-to-peer filesystem.

## API

#### ```var fs = peerfs(storage, opts)```

Returns a [KappaCore](kappa-db/kappa-core) instance. Passes these options directly to that instance. 

#### ```fs.readFile(filename, cb)```

Read asyncronously.

#### ```fs.writeFile(filename, content, cb)```

Write asyncronously.

## License

MIT


