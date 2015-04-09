var restify = require('restify');
var CKS = require('../lib/cks');

var config = require('../config');
var cks = CKS(config);

var server = restify.createServer({
  name: config.name,
});

server.get('/', function(req, res, next) {
  res.send(config.name);
  next();
});

server.get('/derive/:index', cks.routeDerive.bind(cks));

var host = config.host;
var port = config.port;
server.listen(port);
console.log("listening http://" + host + ":" + port);

