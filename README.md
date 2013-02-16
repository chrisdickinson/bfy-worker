# bfy-worker

**not published on npm yet, pending [this pull request getting merged](https://github.com/substack/node-browserify/pull/284).**

(pronounced "beefy worker"), this makes creating web workers from browserify fast, fun, and easy!

```javascript
var spawn = require('bfy-worker')
  , worker

worker = spawn(function() {
  // this executes in a separate thread.
  // *** NB: it can't reach refer to variables from enclosing scope.

  var path = require('path')

  onmessage = function(ev) {
    postMessage(path.join(ev.data[0], ev.data[1]))
  }
}, __dirname)

worker.onmessage = function(ev) {
  console.log(ev.data)
}
worker.postMessage(['hey', 'there'])

``` 

## API

#### spawn = require('bfy-worker')

return the `spawn` function.

#### spawn(functionOrString, workingDir) -> new Worker

creates a new web worker from the provided function or string, places it at `workingDir` relative
to the rest of your modules, and returns a new web worker.

behind the scenes, it rebuilds the bundle you're operating within and creates an object url using
the blob api, and passes the new object url to the worker constructor (so you don't have to host
files at specific locations!) it caches object urls by `workingDir === workingDir && fn === fn`.

## License

MIT

