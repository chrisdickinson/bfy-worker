module.exports = worker

var prelude = require('./prelude')
  , path = require('path')
  , cache = {}
  , make_blob
  , make_url

switch(true) {
  case typeof Blob !== 'undefined':
    make_blob = function(data) {
      return new Blob([data], {'type': 'text/javascript'})
    }
    break
  case typeof BlobBuilder !== 'undefined':
    make_blob = builder(BlobBuilder)
    break
  case typeof MSBlobBuilder !== 'undefined':
    make_blob = builder(MSBlobBuidler)
    break
  case typeof MozBlobBuilder !== 'undefined':
    make_blob = builder(MozBlobBuidler)
    break
  case typeof WebKitBlobBuilder !== 'undefined':
    make_blob = builder(WebKitBlobBuilder)
    break
}

switch(true) {
  case typeof URL !== 'undefined' && !!URL.createObjectURL:
    make_url = urler(URL)
    break
  case typeof webkitURL !== 'undefined' && !!webkitURL.createObjectURL:
    make_url = urler(webkitURL)
    break
  case typeof msURL !== 'undefined' && !!msURL.createObjectURL:
    make_url = urler(msURL)
    break
  case typeof MozURL !== 'undefined' && !!MozURL.createObjectURL:
    make_url = urler(MozURL)
    break
}

function worker(fn, dir) {
  if(typeof fn !== 'string') {
    if(cache[dir] && cache[dir][0] === fn) {
      return new Worker(cache[dir][1])
    }
  }

  fn = fn+''

  var src = make_src(fn, dir)
    , blob = make_blob(src)
    , url = make_url(blob)
    , worker = new Worker(url)

  cache[dir] = [fn, url]

  return worker
}

function builder(type) {
  return function(data) {
    var bb = new type
    bb.append(data)
    return bb.getBlob('text/javascript')
  }
}

function urler(type) {
  return function(blob) {
    return type.createObjectURL(blob)
  }
}

function make_src(fn, dir) {
  var src = [''+prelude.replace('$extensions', '{}')]
    , entry = JSON.stringify(path.join(dir, 'worker.js')) 

  for(var key in require.modules) {
    src.push('require.define('+JSON.stringify(key)+', '+require.modules[key].source+');')
  }

  src.push('require.define('+entry+', '+
  'function(require,module,exports,__dirname,__filename,process,global) { !'+fn+'() });'+
  'require('+entry+');')

  return src.join('')
}
