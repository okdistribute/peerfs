# peerfs

A multiwriter peer-to-peer filesystem.

## API

#### ```var fs = peerfs(storage, opts)```

Returns a [KappaCore](kappa-db/kappa-core) instance. Passes these options directly to that instance. 

#### ```fs.readFile(filename, cb)```

Read asyncronously.

#### ```fs.writeFile(filename, content, cb)```

Write asyncronously.

#### ```fs.createWriteStream(filename, cb)```

Write to a stream.

#### ```fs.createReadStream(filename, cb)```

Write to a stream.

#### TODO

Move all of the functions over from hyperdrive to the top constructor instance.

## License

MIT


