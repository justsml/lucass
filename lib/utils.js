
module.exports = {promised, callbackify, tempFilePath}

// Promise-to-Callback wireup
function callbackify(promiseFn) {
  return function () {
    let args = [...arguments]
    let cb = args[args.length-1] instanceof Function ? args[args.length-1] : () => {console.warn('No callback provided')}
    args = cb ? args.slice(0, args.length - 1) : []
    return args ? promiseFn.apply(this, args).then(results => cb(null, results)).catch(cb) : null
  }
}

function tempFilePath(dir) { return path.join(dir, '.' + Date.now() + Math.random()) }

function promised() {
  var resolve, reject, promise = new Promise((_resolve, _reject) => {resolve = _resolve; reject = _reject })
  return [promise, resolve,  reject]
}
