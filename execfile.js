var Module = require('module')
  , path = require('path')

process.on('message', function(message) {
    console.log('got anything at all')
  var fakeProcess = Object.create(process)
  fakeProcess.on = function(ev, fn) {
    process.on(ev, fn)
    return fakeProcess
  }

  fakeProcess.send = function(data, handle) {
    return process.send({__t: 0, __p: data}, handle)
  }

  if(message.__t === 0) {
    // sent data
    process.emit('data', message.__p) 
  }

  if(message.__t === 2) {
    // load file
    var fn = message.__p.code
      , wrapped = Function('require','module','exports','__dirname','__filename','process','global', '!'+fn+'()')
      , mod = new Module('worker', module)

    mod.filename = path.join(message.__p.filename, 'worker.js')

    wrapped(
        mod.require.bind(mod)
      , mod
      , mod.exports
      , path.dirname(mod.filename)
      , mod.filename
      , fakeProcess 
      , global
    )
  }
})

setInterval(function() {
  process.send({__t:2})
}, 0)
