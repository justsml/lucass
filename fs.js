const fs = require('fs')
const path = require('path')
const hasha = require('hasha')
const isStream = require('is-stream')
const intoStream = require('into-stream')
const {promised, tempFilePath} = require('./lib/utils')

module.exports = FileStore

// FileStore is merely a closure, defining a scope for the shared vars `dir` and `algo`
function FileStore(dir, algo = 'sha256') {
  // n.b. Functional JS doesn't benefit from Java-inspired word vomit :)

  if (!fs.statSync(dir).isDirectory()) throw new Error('Not a directory.')

  // Simply return any "Public" methods - defined below
  // No need for inheritance, `class`/prototype, or shared mutable state! #FTW
  return {hash, set, getBuffer, getStream}

  // Updated to use (simple) Functional Programming concepts - *and patch in callback support*
  function set(value, cb) {
    return __validate(value)            // First check input data
    .then(__saveStream)                 // save stream & return temp path
    .then(filePath => Promise.props({   // BB.Props will resolve __hashStream
        hash: __hashStream(filePath),   // ... here, Hash input,
        filePath,                       // ... next, pass on the `filePath` unchanged
      }))
    .tap(r => console.warn('HASH:', r)) // Optional/Debugging method :)
    .then(__renameWithHash)             // Now, with hash in hand, name file with signature
    .then(hash => cb(null, hash))       // Promise-to-Callback wireup
    .catch(cb)                          // Wire Promise errors to the callback handler
  }

  // Lazily using sindre's hasha for this bit
  function hash(value, cb) {
    return __validate(value)            // Re-use input validation (ensure no ad hoc logic gets slipped in)
      .then(isStream(value) ? hasha.fromStream(value, {algorithm: algo}) : hasha(value, {algorithm: algo}))
      .then(hash => cb(null, hash)).catch(cb) // Promise-to-Callback wireup, w/ err handler
  }

  // Original Method
  function getBuffer(hash, cb) {
    fs.readFile(path.join(dir, hash), cb)
  }

  function getStream(hash) {
    return fs.createReadStream(path.join(dir, hash)).read(0)
  }

  // A central input/state checker, use w/ any input-handling functions
  function __validate(value) {
    if (algo === 'noop') return Promise.reject(new Error('invalid algorithim'))
    return Buffer.isBuffer(value) || (isStream(value) && value.readable) ? Promise.resolve(value) : Promise.reject(new Error('value is a not a valid type'))
  }

  // Saves a readable stream to a temp path and returns the file path
  function __saveStream(stream) {
    // This pattern is well-suited for certain stream and/or event use cases
    // e.g. Avoiding extra closure from `new Promise((resolve, reject)) => {})`
    let [promise, resolve,  reject] = promised()
    let filePath = tempFilePath(dir)
    stream = isStream(stream) ? stream : intoStream(stream)
    stream.pipe(fs.createWriteStream(filePath))
      .on('end', () => resolve(filePath))
      .on('error', reject)
    return promise
  }

  // Accepts a stream (or filePath) and returns a Promise of its Hash
  function __hashStream(stream) {
    stream = typeof stream === 'string' ? fs.createReadStream(stream) : stream
    return hasha.fromStream(stream, {algorithm: algo})
  }

  // Final step, returns the hash when done.
  // After the `.then()`, the file is stored and can be retrieved using its hash.
  function __renameWithHash({filePath, hash}) {
    return fs.renameAsync(filePath, path.join(dir, hash))
      .then(() => ({ hash }))
  }

}