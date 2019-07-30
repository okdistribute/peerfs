# peer-fs

A multiwriter peer-to-peer filesystem. Supports [Hyperdrive V10](https://github.com/mafintosh/hyperdrive/).

## Usage

See [test/index.test.js](test/index.test.js) for examples.

## API

#### ```var drive = KappaDrive(storage, key, opts)```

Returns a [KappaCore](kappa-db/kappa-core) instance. Passes these options directly to that instance.

In addition, peer-fs accepts the following optional arguments:

* `resolveFork`: a function taking `values` of known versions of that file. If there are more than one here, there is a fork. By default, this returns the first item in the list. Overwrite this to get more fancy. 

#### ```drive.replicate()```

Replicate between two `peer-fs` instances.

#### ```drive.readFile(filename, cb)```

Read asyncronously.

#### ```drive.writeFile(filename, content, cb)```

Write asyncronously.

#### ```drive.createWriteStream(filename, cb)```

Write to a stream.

#### ```drive.createReadStream(filename, cb)```

Read file from a stream.

#### ```drive.exists(filename, cb)```

Check a file exists

#### ```drive.truncate(filename, cb)```

Truncate a file

#### ```drive.readdir(name, cb)```

List all files within a specified directory 

## License

MIT

## Credit

Huge credit to [Karissa](https://github.com/karissa) for ideating and writing [peerfs](https://github.com/karissa/peerfs) and allowing us to run with it and complete the API.

:black_heart: :purple_heart: :green_heart:

#### TODO

- [ ] Move all of the functions over from hyperdrive to the top constructor instance. (e.g., readdir, stat)
  - [ ] `lstat`
  - [ ] `readdir`
  - [ ] `open`
  - [ ] `close`
  - [ ] `read`
  - [ ] `write`
  - [x] `truncate`
  - [ ] `unlink`
  - [ ] `mkdir`
  - [ ] `rmdir`
  - [ ] `create`
  - [ ] `_update`
  - [ ] `symlink`
- [ ] Improve performance and stability of index writes by using something other than JSON.
- [ ] Allow resolveFork function to get access to the stat object of the file on that write so that it can make a more intelligent display or make better decisions about the fork
- [ ] Allow forks to be unresolved cc @substack
- [ ] When writing, in the link we should record the seq of the hyperdrive, and on `whoHasFile`, checkout to that seq if its not the latest
